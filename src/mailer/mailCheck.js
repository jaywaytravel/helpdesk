/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Author:     Chris Brame
 *  Updated:    1/20/19 4:43 PM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

const _ = require('lodash')
const async = require('async')
const axios = require('axios')
const Imap = require('imap')
const winston = require('../logger')
const simpleParser = require('mailparser').simpleParser
const cheerio = require('cheerio')
const sanitizeHtml = require('sanitize-html')
const xss = require('xss')
const marked = require('marked')

const emitter = require('../emitter')
const userSchema = require('../models/user')
const groupSchema = require('../models/group')
const ticketTypeSchema = require('../models/tickettype')
const ticketTemplateSchema = require('../models/ticketTemplate')
const statusSchema = require('../models').Status
const Ticket = require('../models/ticket')

const mailCheck = {}
mailCheck.inbox = []

function getMailCheckErrorMessage (err) {
  if (!err) return 'Unknown error'
  if (err.response && err.response.data) {
    const responseData = err.response.data
    if (responseData.error_description) return responseData.error_description
    if (responseData.error && _.isString(responseData.error)) return responseData.error
  }

  return err.message || err.toString()
}

function normalizeBooleanSetting (value) {
  if (_.isBoolean(value)) return value
  if (_.isNumber(value)) return value === 1
  if (_.isString(value)) {
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
  }

  return Boolean(value)
}

function normalizePortSetting (value, defaultPort) {
  const parsed = parseInt(value, 10)
  if (_.isNaN(parsed)) return defaultPort

  return parsed
}

function normalizePollingSetting (value, defaultValue) {
  const parsed = parseInt(value, 10)
  if (_.isNaN(parsed) || parsed <= 0) return defaultValue

  return parsed
}

function normalizeDefaultTicketTypeSetting (value) {
  if (_.isUndefined(value) || _.isNull(value)) return 'Issue'

  const normalized = value.toString().trim()
  if (_.isEmpty(normalized)) return 'Issue'

  return normalized
}

function getTicketTemplateForType (type, callback) {
  if (!type || !type.name) {
    return callback(new Error('MailCheck: Unable to resolve ticket template without a ticket type.'))
  }

  ticketTemplateSchema.getTypeByName(type.name, function (err, template) {
    if (err) return callback(err)
    if (template) return callback(null, template)

    ticketTemplateSchema.getTypes(function (err, templates) {
      if (err) return callback(err)

      const fallbackTemplate = _.first(templates)
      if (!fallbackTemplate) {
        return callback(new Error('MailCheck: No ticket templates are configured.'))
      }

      return callback(null, fallbackTemplate)
    })
  })
}

mailCheck.init = function (settings) {
  var s = {}
  s.mailerCheckEnabled = _.find(settings, function (x) {
    return x.name === 'mailer:check:enable'
  })
  s.mailerCheckHost = _.find(settings, function (x) {
    return x.name === 'mailer:check:host'
  })
  s.mailerCheckPort = _.find(settings, function (x) {
    return x.name === 'mailer:check:port'
  })
  s.mailerCheckUsername = _.find(settings, function (x) {
    return x.name === 'mailer:check:username'
  })
  s.mailerCheckPassword = _.find(settings, function (x) {
    return x.name === 'mailer:check:password'
  })
  s.mailerCheckOAuth2 = _.find(settings, function (x) {
    return x.name === 'mailer:check:oauth2'
  })
  s.mailerCheckOAuth2ClientId = _.find(settings, function (x) {
    return x.name === 'mailer:check:oauthclientid'
  })
  s.mailerCheckOAuth2ClientSecret = _.find(settings, function (x) {
    return x.name === 'mailer:check:oauthclientsecret'
  })
  s.mailerCheckOAuth2RefreshToken = _.find(settings, function (x) {
    return x.name === 'mailer:check:oauthrefreshtoken'
  })
  s.mailerCheckSelfSign = _.find(settings, function (x) {
    return x.name === 'mailer:check:selfsign'
  })
  s.mailerCheckPolling = _.find(settings, function (x) {
    return x.name === 'mailer:check:polling'
  })
  s.mailerCheckTicketType = _.find(settings, function (x) {
    return x.name === 'mailer:check:ticketype'
  })
  s.mailerCheckTicketPriority = _.find(settings, function (x) {
    return x.name === 'mailer:check:ticketpriority'
  })
  s.mailerCheckCreateAccount = _.find(settings, function (x) {
    return x.name === 'mailer:check:createaccount'
  })
  s.mailerCheckDeleteMessage = _.find(settings, function (x) {
    return x.name === 'mailer:check:deletemessage'
  })
  s.mailerFrom = _.find(settings, function (x) {
    return x.name === 'mailer:from'
  })

  s.mailerCheckEnabled = s.mailerCheckEnabled === undefined ? { value: false } : s.mailerCheckEnabled
  s.mailerCheckHost = s.mailerCheckHost === undefined ? { value: '' } : s.mailerCheckHost
  s.mailerCheckPort = s.mailerCheckPort === undefined ? { value: 143 } : s.mailerCheckPort
  s.mailerCheckUsername = s.mailerCheckUsername === undefined ? { value: '' } : s.mailerCheckUsername
  s.mailerCheckPassword = s.mailerCheckPassword === undefined ? { value: '' } : s.mailerCheckPassword
  s.mailerCheckOAuth2 = s.mailerCheckOAuth2 === undefined ? { value: false } : s.mailerCheckOAuth2
  s.mailerCheckOAuth2ClientId =
    s.mailerCheckOAuth2ClientId === undefined ? { value: '' } : s.mailerCheckOAuth2ClientId
  s.mailerCheckOAuth2ClientSecret =
    s.mailerCheckOAuth2ClientSecret === undefined ? { value: '' } : s.mailerCheckOAuth2ClientSecret
  s.mailerCheckOAuth2RefreshToken =
    s.mailerCheckOAuth2RefreshToken === undefined ? { value: '' } : s.mailerCheckOAuth2RefreshToken
  s.mailerCheckSelfSign = s.mailerCheckSelfSign === undefined ? { value: false } : s.mailerCheckSelfSign
  s.mailerCheckPolling = s.mailerCheckPolling === undefined ? { value: 60000 } : s.mailerCheckPolling // 1 min
  s.mailerCheckTicketType = s.mailerCheckTicketType === undefined ? { value: 'Issue' } : s.mailerCheckTicketType
  s.mailerCheckTicketPriority = s.mailerCheckTicketPriority === undefined ? { value: '' } : s.mailerCheckTicketPriority
  s.mailerCheckCreateAccount = s.mailerCheckCreateAccount === undefined ? { value: false } : s.mailerCheckCreateAccount
  s.mailerCheckDeleteMessage = s.mailerCheckDeleteMessage === undefined ? { value: false } : s.mailerCheckDeleteMessage
  s.mailerFrom = s.mailerFrom === undefined ? { value: '' } : s.mailerFrom

  const MAILERCHECK_ENABLED = normalizeBooleanSetting(s.mailerCheckEnabled.value)
  const MAILERCHECK_HOST = s.mailerCheckHost.value
  const MAILERCHECK_USER = s.mailerCheckUsername.value
  const MAILERCHECK_PASS = s.mailerCheckPassword.value
  const MAILERCHECK_OAUTH2 = normalizeBooleanSetting(s.mailerCheckOAuth2.value)
  const MAILERCHECK_OAUTH2_CLIENT_ID = s.mailerCheckOAuth2ClientId.value
  const MAILERCHECK_OAUTH2_CLIENT_SECRET = s.mailerCheckOAuth2ClientSecret.value
  const MAILERCHECK_OAUTH2_REFRESH_TOKEN = s.mailerCheckOAuth2RefreshToken.value
  const MAILERCHECK_PORT = normalizePortSetting(s.mailerCheckPort.value, 143)
  const MAILERCHECK_TLS = MAILERCHECK_PORT === 993
  const MAILERCHECK_SELFSIGN = normalizeBooleanSetting(s.mailerCheckSelfSign.value)
  const POLLING_INTERVAL = normalizePollingSetting(s.mailerCheckPolling.value, 60000)

  if (!MAILERCHECK_ENABLED) return true

  let tlsOptions = {}
  if (MAILERCHECK_SELFSIGN) tlsOptions = { rejectUnauthorized: false }

  mailCheck.connectionOptions = {
    user: MAILERCHECK_USER,
    password: MAILERCHECK_PASS,
    oauth2: MAILERCHECK_OAUTH2,
    oauth2ClientId: MAILERCHECK_OAUTH2_CLIENT_ID,
    oauth2ClientSecret: MAILERCHECK_OAUTH2_CLIENT_SECRET,
    oauth2RefreshToken: MAILERCHECK_OAUTH2_REFRESH_TOKEN,
    host: MAILERCHECK_HOST,
    port: MAILERCHECK_PORT,
    tls: MAILERCHECK_TLS,
    tlsOptions: tlsOptions
  }

  mailCheck.fetchMailOptions = {
    defaultTicketType: normalizeDefaultTicketTypeSetting(s.mailerCheckTicketType.value),
    defaultPriority: s.mailerCheckTicketPriority.value,
    createAccount: s.mailerCheckCreateAccount.value,
    deleteMessage: s.mailerCheckDeleteMessage.value,
    mailboxUser: MAILERCHECK_USER,
    mailerFrom: s.mailerFrom.value
  }

  mailCheck.messages = []
  mailCheck.isFetching = false

  winston.info('MailCheck: Initialized. Polling interval %s seconds.', POLLING_INTERVAL / 1000)
  winston.info('MailCheck: Authentication mode %s.', MAILERCHECK_OAUTH2 ? 'OAuth2' : 'password')
  winston.info(
    'MailCheck: Connection settings host=%s port=%s tls=%s selfSigned=%s.',
    MAILERCHECK_HOST,
    MAILERCHECK_PORT,
    MAILERCHECK_TLS,
    MAILERCHECK_SELFSIGN
  )

  mailCheck.fetchMail()
  mailCheck.checkTimer = setInterval(function () {
    mailCheck.fetchMail()
  }, POLLING_INTERVAL)
}

mailCheck.refetch = function () {
  if (_.isUndefined(mailCheck.fetchMailOptions)) {
    winston.warn('Mailcheck.refetch() running before Mailcheck.init(); please run Mailcheck.init() prior')
    return
  }

  winston.info('MailCheck: Manual fetch requested.')
  mailCheck.fetchMail()
}

function bindImapError () {
  mailCheck.Imap.on('error', function (err) {
    mailCheck.isFetching = false
    winston.warn('MailCheck: IMAP error - ' + getMailCheckErrorMessage(err))
  })
}

function bindImapReady () {
  try {
    mailCheck.Imap.on('ready', function () {
      winston.info('MailCheck: IMAP authenticated. Opening INBOX.')
      openInbox(function (err) {
        if (err) {
          mailCheck.Imap.end()
          winston.warn('MailCheck: Failed to open INBOX - ' + getMailCheckErrorMessage(err))
        } else {
          async.waterfall(
            [
              function (next) {
                mailCheck.Imap.search(['UNSEEN'], next)
              },
              function (results, next) {
                if (_.size(results) < 1) {
                  winston.info('MailCheck: No unread messages found.')
                  return next()
                }

                winston.info('MailCheck: Processing %s message(s).', _.size(results))

                var flag = '\\Seen'
                if (mailCheck.fetchMailOptions.deleteMessage) {
                  flag = '\\Deleted'
                }

                var f = mailCheck.Imap.fetch(results, {
                  bodies: ''
                })

                f.once('error', function (err) {
                  winston.warn('MailCheck: Fetch stream failed - ' + getMailCheckErrorMessage(err))
                })

                f.on('message', function (msg) {
                  msg.on('body', function (stream) {
                    var message = {}
                    var buffer = ''
                    stream.on('data', function (chunk) {
                      buffer += chunk.toString('utf8')
                    })

                    stream.once('end', function () {
                      simpleParser(buffer, function (err, mail) {
                        if (err) winston.warn(err)

                        if (mail.headers.has('from')) {
                          message.from = mail.headers.get('from').value[0].address
                        }

                        if (mail.subject) {
                          message.subject = mail.subject
                        } else {
                          message.subject = message.from
                        }

                        message.text = mail.text || ''

                        if (_.isUndefined(mail.textAsHtml)) {
                          const $ = cheerio.load(mail.html)
                          const $body = $('body')
                          message.body = $body.length > 0 ? $body.html() : mail.html
                        } else {
                          message.body = mail.textAsHtml
                        }

                        if (_.isEmpty(message.text) && !_.isEmpty(message.body)) {
                          var $parsedBody = cheerio.load(message.body)
                          message.text = $parsedBody.text()
                        }

                        mailCheck.messages.push(message)
                      })
                    })
                  })
                })

                f.on('end', function () {
                  winston.info('MailCheck: Finished downloading %s message(s). Applying flag %s.', _.size(results), flag)
                  mailCheck.Imap.addFlags(results, flag, function (err) {
                    if (err) {
                      winston.warn('MailCheck: Failed to add flags - ' + getMailCheckErrorMessage(err))
                    } else {
                      winston.info('MailCheck: Flags applied successfully.')
                    }

                    mailCheck.Imap.closeBox(true, function (err) {
                      if (err) {
                        winston.warn('MailCheck: Failed to close mailbox - ' + getMailCheckErrorMessage(err))
                      } else {
                        winston.info('MailCheck: Mailbox closed. Processing parsed messages.')
                      }

                      mailCheck.Imap.end()
                      handleMessages(mailCheck.messages, function (err) {
                        if (err) {
                          winston.warn('MailCheck: Message handling failed - ' + getMailCheckErrorMessage(err))
                        } else {
                          winston.info('MailCheck: Message handling completed.')
                        }

                        mailCheck.isFetching = false
                        winston.info('MailCheck: Poll cycle finished.')
                        mailCheck.Imap.destroy()
                        return next(err)
                      })
                    })
                  })
                })
              }
            ],
            function (err) {
              if (err) winston.warn('MailCheck: Polling failed - ' + getMailCheckErrorMessage(err))
              mailCheck.isFetching = false
              winston.info('MailCheck: Poll cycle cleanup complete.')
              mailCheck.Imap.end()
            }
          )
        }
      })
    })
  } catch (error) {
    mailCheck.isFetching = false
    winston.warn('MailCheck: Unexpected IMAP setup error - ' + getMailCheckErrorMessage(error))
    mailCheck.Imap.end()
  }
}

async function getMailCheckXOAuth2Token () {
  if (!mailCheck.connectionOptions.oauth2) return null

  if (
    _.isEmpty(mailCheck.connectionOptions.oauth2ClientId) ||
    _.isEmpty(mailCheck.connectionOptions.oauth2ClientSecret) ||
    _.isEmpty(mailCheck.connectionOptions.oauth2RefreshToken) ||
    _.isEmpty(mailCheck.connectionOptions.user)
  ) {
    throw new Error('MailCheck OAuth2 is enabled but required OAuth settings are missing.')
  }

  const params = new URLSearchParams({
    client_id: mailCheck.connectionOptions.oauth2ClientId,
    client_secret: mailCheck.connectionOptions.oauth2ClientSecret,
    refresh_token: mailCheck.connectionOptions.oauth2RefreshToken,
    grant_type: 'refresh_token'
  })

  let response = null
  try {
    response = await axios.post('https://oauth2.googleapis.com/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
  } catch (err) {
    throw new Error('MailCheck OAuth2 token request failed: ' + getMailCheckErrorMessage(err))
  }

  if (!response.data || _.isEmpty(response.data.access_token)) {
    throw new Error('MailCheck OAuth2 token response did not include an access token.')
  }

  return Buffer.from(
    `user=${mailCheck.connectionOptions.user}\u0001auth=Bearer ${response.data.access_token}\u0001\u0001`
  ).toString('base64')
}

async function createImapConnection () {
  const config = {
    user: mailCheck.connectionOptions.user,
    host: mailCheck.connectionOptions.host,
    port: mailCheck.connectionOptions.port,
    tls: mailCheck.connectionOptions.tls,
    tlsOptions: mailCheck.connectionOptions.tlsOptions
  }

  if (mailCheck.connectionOptions.oauth2) {
    config.xoauth2 = await getMailCheckXOAuth2Token()
  } else {
    config.password = mailCheck.connectionOptions.password
  }

  mailCheck.Imap = new Imap(config)
  bindImapError()
  bindImapReady()
}

mailCheck.fetchMail = async function () {
  if (mailCheck.isFetching) {
    winston.info('MailCheck: Poll skipped because a previous mailbox poll is still in progress.')
    return
  }

  try {
    mailCheck.isFetching = true
    mailCheck.messages = []
    winston.info('MailCheck: Polling mailbox for unread messages.')
    await createImapConnection()
    mailCheck.Imap.connect()
  } catch (err) {
    mailCheck.isFetching = false
    if (mailCheck.Imap) mailCheck.Imap.end()
    winston.warn('MailCheck: Unable to start poll - ' + getMailCheckErrorMessage(err))
  }
}

function parseMailboxAddress (value) {
  if (_.isUndefined(value) || _.isNull(value)) return ''

  const stringValue = value.toString().trim()
  if (_.isEmpty(stringValue)) return ''

  const match = stringValue.match(/<([^>]+)>/)
  const email = match ? match[1] : stringValue

  return email.trim().toLowerCase()
}

function extractTicketUid (subject) {
  if (_.isUndefined(subject) || _.isNull(subject)) return null

  const match = subject.toString().match(/ticket\s*#\s*(\d+)/i)
  if (!match || !match[1]) return null

  return Number(match[1])
}

function stripQuotedReply (text) {
  if (_.isUndefined(text) || _.isNull(text)) return ''

  const normalizedText = text.toString().replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (_.isEmpty(normalizedText)) return ''

  const markers = [/^On .*wrote:\s*$/im, /^From:\s.*$/im, /^-----Original Message-----\s*$/im]
  let cutIndex = normalizedText.length

  markers.forEach(function (regex) {
    const match = regex.exec(normalizedText)
    if (match && match.index < cutIndex) cutIndex = match.index
  })

  let cleanedText = normalizedText.substring(0, cutIndex).trim()
  const quotedLineIndex = cleanedText.search(/^\s*>/m)
  if (quotedLineIndex !== -1) cleanedText = cleanedText.substring(0, quotedLineIndex).trim()

  return cleanedText
}

function buildReplyComment (message) {
  let text = message.text || ''

  if (_.isEmpty(text) && !_.isEmpty(message.body)) {
    const $ = cheerio.load(message.body)
    text = $.text()
  }

  text = stripQuotedReply(text)
  if (_.isEmpty(text)) return ''

  marked.setOptions({
    breaks: true
  })

  text = sanitizeHtml(text).trim()
  if (_.isEmpty(text)) return ''

  return xss(marked.parse(text))
}

function shouldIgnoreMessage (message) {
  const from = parseMailboxAddress(message.from)
  if (_.isEmpty(from)) return true

  const mailboxUser = parseMailboxAddress(mailCheck.fetchMailOptions.mailboxUser)
  const mailerFrom = parseMailboxAddress(mailCheck.fetchMailOptions.mailerFrom)
  const supportEmail = parseMailboxAddress(process.env.SUPPORT_EMAIL || 'support@jaywaytravel.com')
  const subject = (message.subject || '').toString().toLowerCase()

  if (from === mailboxUser || from === mailerFrom || from === supportEmail) return true

  if (
    subject.indexOf('out of office') !== -1 ||
    subject.indexOf('automatic reply') !== -1 ||
    subject.indexOf('autoreply') !== -1 ||
    subject.indexOf('auto reply') !== -1
  ) {
    return true
  }

  return false
}

function userCanReplyToTicket (ticket, user) {
  if (!ticket || !user) return false

  if (ticket.owner && ticket.owner._id.toString() === user._id.toString()) return true
  if (ticket.assignee && ticket.assignee._id.toString() === user._id.toString()) return true

  return _.some(ticket.subscribers, function (subscriber) {
    return subscriber && subscriber._id && subscriber._id.toString() === user._id.toString()
  })
}

function handleMessages (messages, done) {
  let createdTicketCount = 0
  let createdCommentCount = 0
  winston.info('MailCheck: Starting message handling for %s parsed message(s).', _.size(messages))
  async.eachSeries(
    messages,
    function (message, nextMessage) {
      if (shouldIgnoreMessage(message)) {
        winston.debug('MailCheck: Ignoring self-sent or auto-reply email from %s', message.from)
        return nextMessage()
      }

      if (
        _.isUndefined(message.from) ||
        _.isEmpty(message.from) ||
        _.isUndefined(message.subject) ||
        _.isEmpty(message.subject) ||
        (_.isUndefined(message.body) && _.isUndefined(message.text)) ||
        (_.isEmpty(message.body) && _.isEmpty(message.text))
      ) {
        return nextMessage()
      }

      async.auto(
        {
          handleUser: function (callback) {
            message.ticketUid = extractTicketUid(message.subject)

            userSchema.getUserByEmail(message.from, function (err, user) {
              if (err) winston.warn(err)
              if (!err && user) {
                message.owner = user
                return callback(null, user)
              }

              // User doesn't exist. Lets create public user... If we want too
              if (mailCheck.fetchMailOptions.createAccount) {
                userSchema.createUserFromEmail(message.from, function (err, response) {
                  if (err) return callback(err)

                  message.owner = response.user
                  message.group = response.group

                  return callback(null, response)
                })
              } else {
                return callback(new Error('No User found.'))
              }
            })
          },
          handleReplyTicket: [
            'handleUser',
            function (results, callback) {
              if (!message.ticketUid) return callback(null, null)

              Ticket.getTicketByUid(message.ticketUid, function (err, ticket) {
                if (err) return callback(err)
                if (!ticket) {
                  winston.warn('MailCheck: Unable to find ticket for reply subject: ' + message.subject)
                  return callback(null, null)
                }

                if (!userCanReplyToTicket(ticket, message.owner)) {
                  winston.warn('MailCheck: Ignoring unauthorized reply for ticket #' + ticket.uid)
                  return callback(null, null)
                }

                const commentText = buildReplyComment(message)
                if (_.isEmpty(commentText)) {
                  winston.warn('MailCheck: Ignoring empty reply body for ticket #' + ticket.uid)
                  return callback(null, null)
                }

                const Comment = {
                  owner: message.owner._id,
                  date: new Date(),
                  comment: commentText
                }

                ticket.updated = Date.now()
                ticket.comments.push(Comment)
                ticket.history.push({
                  action: 'ticket:comment:added',
                  description: 'Comment was added by email reply',
                  owner: message.owner._id
                })

                ticket.save(function (err, savedTicket) {
                  if (err) return callback(err)

                  emitter.emit('ticket:comment:added', savedTicket, Comment)
                  createdCommentCount++
                  winston.info('MailCheck: Added reply comment to ticket #%s from %s', ticket.uid, message.from)

                  return callback(null, savedTicket)
                })
              })
            }
          ],
          handleGroup: [
            'handleUser',
            'handleReplyTicket',
            function (results, callback) {
              if (message.ticketUid) return callback()

              if (!_.isUndefined(message.group)) {
                return callback()
              }

              groupSchema.getAllGroupsOfUser(message.owner._id, function (err, group) {
                if (err) return callback(err)
                if (!group) return callback(new Error('Unknown group for user: ' + message.owner.email))

                if (_.isArray(group)) {
                  message.group = _.first(group)
                } else {
                  message.group = group
                }

                if (!message.group) {
                  groupSchema.create(
                    {
                      name: message.owner.email,
                      members: [message.owner._id],
                      sendMailTo: [message.owner._id],
                      public: true
                    },
                    function (err, group) {
                      if (err) return callback(err)
                      message.group = group
                      return callback(null, group)
                    }
                  )
                } else {
                  return callback(null, group)
                }
              })
            }
          ],
          handleTicketType: ['handleReplyTicket', function (results, callback) {
            if (message.ticketUid) return callback()

            if (_.isEmpty(mailCheck.fetchMailOptions.defaultTicketType) || mailCheck.fetchMailOptions.defaultTicketType === 'Issue') {
              ticketTypeSchema.getTypeByName('Issue', function (err, type) {
                if (err) return callback(err)
                if (!type) return callback(new Error('MailCheck: Default ticket type "Issue" was not found.'))

                mailCheck.fetchMailOptions.defaultTicketType = type._id
                message.type = type

                return callback(null, type)
              })
            } else {
              ticketTypeSchema.getType(mailCheck.fetchMailOptions.defaultTicketType, function (err, type) {
                if (err) return callback(err)
                if (!type) return callback(new Error('MailCheck: Invalid default ticket type.'))

                message.type = type

                return callback(null, type)
              })
            }
          }],
          handlePriority: [
            'handleTicketType',
            'handleReplyTicket',
            function (result, callback) {
              if (message.ticketUid) return callback()

              var type = result.handleTicketType

              if (mailCheck.fetchMailOptions.defaultPriority !== '') {
                return callback(null, mailCheck.fetchMailOptions.defaultPriority)
              }

              var firstPriority = _.first(type.priorities)
              if (!_.isUndefined(firstPriority)) {
                mailCheck.fetchMailOptions.defaultPriority = firstPriority._id
              } else {
                return callback(new Error('Invalid default priority'))
              }

              return callback(null, firstPriority._id)
            }
          ],
          handleTemplate: [
            'handleTicketType',
            'handleReplyTicket',
            function (results, callback) {
              if (message.ticketUid) return callback()

              return getTicketTemplateForType(results.handleTicketType, function (err, template) {
                if (err) return callback(err)

                message.template = template
                return callback(null, template._id)
              })
            }
          ],
          handleStatus: ['handleReplyTicket', function (results, callback) {
            if (message.ticketUid) return callback()

            statusSchema.getStatus(function (err, statuses) {
              if (err) return callback(err)

              const status = _.first(statuses)

              if (!status) return callback(new Error('Invalid status'))

              message.status = status._id

              return callback(null, status._id)
            })
          }],
          handleCreateTicket: [
            'handleReplyTicket',
            'handleGroup',
            'handlePriority',
            'handleTemplate',
            'handleStatus',
            function (results, callback) {
              if (message.ticketUid) return callback()

              var HistoryItem = {
                action: 'ticket:created',
                description: 'Ticket was created.',
                owner: message.owner._id
              }

              Ticket.create(
                {
                  owner: message.owner._id,
                  group: message.group._id,
                  type: message.type._id,
                  template: results.handleTemplate,
                  status: results.handleStatus,
                  priority: results.handlePriority,
                  subject: message.subject,
                  issue: message.body,
                  history: [HistoryItem],
                  subscribers: [message.owner._id]
                },
                function (err, ticket) {
                  if (err) {
                    winston.warn('Failed to create ticket from email: ' + err)
                    return callback(err)
                  }

                  emitter.emit('ticket:created', {
                    socketId: '',
                    ticket: ticket
                  })

                  createdTicketCount++
                  winston.info('MailCheck: Created ticket #%s from %s', ticket.uid, message.from)
                  return callback()
                }
              )
            }
          ]
        },
        function (err) {
          return nextMessage(err)
        }
      )
    },
    function (err) {
      winston.info('MailCheck: Created %s ticket(s) and %s comment(s) from mail.', createdTicketCount, createdCommentCount)

      return done(err)
    }
  )
}

function openInbox (cb) {
  mailCheck.Imap.openBox('INBOX', cb)
}
module.exports = mailCheck
