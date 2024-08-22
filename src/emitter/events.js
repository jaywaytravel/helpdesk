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
const path = require('path')
const async = require('async')
const winston = require('../logger')
const emitter = require('../emitter')
const NotificationSchema = require('../models/notification')
const settingsSchema = require('../models/setting')
const Email = require('email-templates')
const templateDir = path.resolve(__dirname, '..', 'mailer', 'templates')
const socketEvents = require('../socketio/socketEventConsts')
const notifications = require('../notifications') // Load Push Events

const eventTicketCreated = require('./events/event_ticket_created')

const BASE_URL = 'helpdesk.jaywaytravel.com'

function formatDateToGMT (isoDateString) {
  const date = new Date(isoDateString)

  const options = {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Europe/Berlin',
    timeZoneName: 'short'
  }

  return date.toLocaleString('en-US', options)
}

;(function () {
  notifications.init(emitter)

  emitter.on('ticket:created', async function (data) {
    await eventTicketCreated(data)
  })

  emitter.on('ticket:updated', function (ticket) {
    io.sockets.emit('$trudesk:client:ticket:updated', { ticket })
  })

  emitter.on('ticket:deleted', function (oId) {
    io.sockets.emit('ticket:delete', oId)
    io.sockets.emit('$trudesk:client:ticket:deleted', oId)
  })

  emitter.on('ticket:subscriber:update', function (data) {
    io.sockets.emit('ticket:subscriber:update', data)
  })

  emitter.on('ticket:comment:added', function (ticket, comment, hostname) {
    // Goes to client
    io.sockets.emit(socketEvents.TICKETS_UPDATE, ticket)

    settingsSchema.getSettingsByName(
      ['tps:enable', 'tps:username', 'tps:apikey', 'mailer:enable'],
      function (err, tpsSettings) {
        if (err) return false

        let tpsEnabled = _.head(_.filter(tpsSettings, ['name', 'tps:enable']))
        let tpsUsername = _.head(_.filter(tpsSettings, ['name', 'tps:username']))
        let tpsApiKey = _.head(_.filter(tpsSettings), ['name', 'tps:apikey'])
        let mailerEnabled = _.head(_.filter(tpsSettings), ['name', 'mailer:enable'])
        mailerEnabled = !mailerEnabled ? false : mailerEnabled.value

        if (!tpsEnabled || !tpsUsername || !tpsApiKey) {
          tpsEnabled = false
        } else {
          tpsEnabled = tpsEnabled.value
          tpsUsername = tpsUsername.value
          tpsApiKey = tpsApiKey.value
        }

        async.parallel(
          [
            // Send email to subscribed users
            function (c) {
              if (!mailerEnabled) return c()

              console.log('in function')

              const mailer = require('../mailer')
              let emails = []
              async.each(
                ticket.subscribers,
                function (member, cb) {
                  if (_.isUndefined(member) || _.isUndefined(member.email)) return cb()
                  if (member._id.toString() === comment.owner.toString()) return cb()
                  if (member.deleted) return cb()

                  emails.push(member.email)

                  cb()
                },
                function (err) {
                  if (err) return c(err)

                  emails = _.uniq(emails)

                  let recipient = []
                  if (process.env.SUPPORT_EMAIL) {
                    recipient = [process.env.SUPPORT_EMAIL]
                  } else {
                    recipient = ['alexey@jaywaytravel.com']
                  }

                  emails.push(recipient)

                  if (_.size(emails) < 1) {
                    return c()
                  }

                  const email = new Email({
                    views: {
                      root: templateDir,
                      options: {
                        extension: 'handlebars'
                      }
                    }
                  })

                  ticket.populate('comments.owner', function (err, ticket) {
                    if (err) winston.warn(err)
                    if (err) return c()

                    function addBaseUrlToImgSrc (ticketJSON, baseUrl) {
                      const imgTagRegex = /(<img\s+[^>]*src=["'])(\/[^"']*["'][^>]*>)/gi
                      const updatedTicketJSON = JSON.parse(JSON.stringify(ticketJSON))

                      updatedTicketJSON.date = formatDateToGMT(ticket.date)

                      updatedTicketJSON.issue = updatedTicketJSON.issue.replace(imgTagRegex, `$1${baseUrl}$2`)

                      return updatedTicketJSON
                    }

                    ticket.date = formatDateToGMT(ticket.date)

                    ticket.updated = formatDateToGMT(ticket.updated)

                    ticket.comments = ticket.comments.map(comment => {
                      const updatedComment = JSON.parse(JSON.stringify(comment))
                      const imgTagRegex = /(<img\s+[^>]*src=["'])(\/[^"']*["'][^>]*>)/gi
                      comment.comment = updatedComment.comment.replace(
                        imgTagRegex,
                        `$1${process.env.BASE_URL ? process.env.BASE_URL : BASE_URL}$2`
                      )

                      return {
                        comment: comment.comment,
                        date: formatDateToGMT(comment.date)
                      }
                    })

                    const updatedTicketJSON = addBaseUrlToImgSrc(
                      ticket,
                      process.env.BASE_URL ? process.env.BASE_URL : BASE_URL
                    )

                    email
                      .render('ticket-comment-added', {
                        ticket: updatedTicketJSON,
                        comment
                      })
                      .then(function (html) {
                        const mailOptions = {
                          to: emails.join(),
                          subject:
                            'Ticket #' +
                            ticket.uid +
                            ' Updated' +
                            ' - ' +
                            ticket.subject +
                            ' - ' +
                            ticket.priority.name +
                            ' ' +
                            ticket.type.name,
                          html,
                          generateTextFromHTML: true
                        }

                        mailer.sendMail(mailOptions, function (err) {
                          if (err) winston.warn('[trudesk:events:sendSubscriberEmail] - ' + err)

                          winston.debug('Sent [' + emails.length + '] emails.')
                        })

                        return c()
                      })
                      .catch(function (err) {
                        winston.warn('[trudesk:events:sendSubscriberEmail] - ' + err)
                        return c(err)
                      })
                  })
                }
              )
            }
          ],
          function () {
            // Blank
          }
        )
      }
    )
  })

  emitter.on('ticket:note:added', function (ticket, note) {
    // Goes to client
    io.sockets.emit('updateNotes', ticket)

    settingsSchema.getSettingsByName(
      ['tps:enable', 'tps:username', 'tps:apikey', 'mailer:enable'],
      function (err, tpsSettings) {
        if (err) return false

        let tpsEnabled = _.head(_.filter(tpsSettings, ['name', 'tps:enable']))
        let tpsUsername = _.head(_.filter(tpsSettings, ['name', 'tps:username']))
        let tpsApiKey = _.head(_.filter(tpsSettings), ['name', 'tps:apikey'])
        let mailerEnabled = _.head(_.filter(tpsSettings), ['name', 'mailer:enable'])
        mailerEnabled = !mailerEnabled ? false : mailerEnabled.value

        if (!tpsEnabled || !tpsUsername || !tpsApiKey) {
          tpsEnabled = false
        } else {
          tpsEnabled = tpsEnabled.value
          tpsUsername = tpsUsername.value
          tpsApiKey = tpsApiKey.value
        }

        async.parallel(
          [
            // Send email to subscribed users
            function (c) {
              if (!mailerEnabled) return c()

              console.log('in function')

              const mailer = require('../mailer')
              let emails = []
              async.each(
                ticket.subscribers,
                function (member, cb) {
                  // if (_.isUndefined(member) || _.isUndefined(member.email)) return cb()
                  // if (member._id.toString() === note.owner.toString()) return cb()
                  // if (member.deleted) return cb()

                  // emails.push(member.email)

                  cb()
                },
                function (err) {
                  if (err) return c(err)

                  emails = _.uniq(emails)

                  let recipient = []
                  if (process.env.SUPPORT_EMAIL) {
                    recipient = [process.env.SUPPORT_EMAIL]
                  } else {
                    recipient = ['alexey@jaywaytravel.com']
                  }

                  emails.push(recipient)

                  if (_.size(emails) < 1) {
                    return c()
                  }

                  const email = new Email({
                    views: {
                      root: templateDir,
                      options: {
                        extension: 'handlebars'
                      }
                    }
                  })

                  ticket.populate('notes.owner', function (err, ticket) {
                    if (err) winston.warn(err)
                    if (err) return c()

                    function addBaseUrlToImgSrc (ticketJSON, baseUrl) {
                      const imgTagRegex = /(<img\s+[^>]*src=["'])(\/[^"']*["'][^>]*>)/gi
                      const updatedTicketJSON = JSON.parse(JSON.stringify(ticketJSON))

                      updatedTicketJSON.date = formatDateToGMT(ticket.date)

                      updatedTicketJSON.issue = updatedTicketJSON.issue.replace(imgTagRegex, `$1${baseUrl}$2`)

                      return updatedTicketJSON
                    }

                    ticket.date = formatDateToGMT(ticket.date)

                    ticket.updated = formatDateToGMT(ticket.updated)

                    ticket.notes = ticket.notes.map(note => {
                      const updatedComment = JSON.parse(JSON.stringify(note))
                      const imgTagRegex = /(<img\s+[^>]*src=["'])(\/[^"']*["'][^>]*>)/gi
                      note.note = updatedComment.note.replace(
                        imgTagRegex,
                        `$1${process.env.BASE_URL ? process.env.BASE_URL : BASE_URL}$2`
                      )

                      return {
                        note: note.note,
                        date: formatDateToGMT(note.date)
                      }
                    })

                    const updatedTicket = addBaseUrlToImgSrc(
                      ticket,
                      process.env.BASE_URL ? process.env.BASE_URL : BASE_URL
                    )

                    email
                      .render('ticket-note-added', {
                        updatedTicket,
                        note
                      })
                      .then(function (html) {
                        const mailOptions = {
                          to: emails.join(),
                          subject:
                            'Ticket #' +
                            ticket.uid +
                            ' Updated' +
                            ' - ' +
                            ticket.subject +
                            ' - ' +
                            ticket.priority.name +
                            ' ' +
                            ticket.type.name,
                          html,
                          generateTextFromHTML: true
                        }

                        mailer.sendMail(mailOptions, function (err) {
                          if (err) winston.warn('[trudesk:events:sendSubscriberEmail] - ' + err)

                          winston.debug('Sent [' + emails.length + '] emails.')
                        })

                        return c()
                      })
                      .catch(function (err) {
                        winston.warn('[trudesk:events:sendSubscriberEmail] - ' + err)
                        return c(err)
                      })
                  })
                }
              )
            }
          ],
          function () {
            // Blank
          }
        )
      }
    )
  })

  emitter.on('trudesk:profileImageUpdate', function (data) {
    io.sockets.emit('trudesk:profileImageUpdate', data)
  })

  emitter.on(socketEvents.ROLES_FLUSH, function () {
    require('../permissions').register(function () {
      io.sockets.emit(socketEvents.ROLES_FLUSH)
    })
  })
})()
