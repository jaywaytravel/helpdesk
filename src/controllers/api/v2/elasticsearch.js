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
 *  Updated:    4/14/19 2:32 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

const _ = require('lodash')
const winston = require('../../../logger')
const es = require('../../../elasticsearch')
const ticketSchema = require('../../../models/ticket')
const groupSchema = require('../../../models/group')

const apiElasticSearch = {}
const apiUtil = require('../apiUtils')

apiElasticSearch.rebuild = (req, res) => {
  es.rebuildIndex()

  return apiUtil.sendApiSuccess(res)
}

apiElasticSearch.status = async (req, res) => {
  const response = {}

  try {
    const getIndexCountData = () =>
      new Promise((resolve, reject) => {
        ;(async () => {
          try {
            const data = await es.getIndexCount()
            const indexCount = !_.isUndefined(data.count) ? data.count : 0

            resolve(indexCount)
          } catch (e) {
            reject(e)
          }
        })()
      })

    const getDBCount = () =>
      new Promise((resolve, reject) => {
        ;(async () => {
          try {
            const ticketCount = await ticketSchema.getCount()
            resolve(ticketCount)
          } catch (e) {
            reject(e)
          }
        })()
      })

    const [, indexCount, ticketCount] = await Promise.all([es.checkConnection(), getIndexCountData(), getDBCount()])
    response.indexCount = indexCount
    response.dbCount = ticketCount
    response.esStatus = global.esStatus
    response.isRebuilding = global.esRebuilding === true
    response.inSync = response.dbCount === response.indexCount

    return apiUtil.sendApiSuccess(res, { status: response })
  } catch (e) {
    if (process.env.NODE_ENV === 'development') winston.warn(e.message)

    return apiUtil.sendApiError(res, 500, e.message)
  }
}

apiElasticSearch.search = function (req, res) {
  let limit = !_.isUndefined(req.query.limit) ? req.query.limit : 100
  try {
    limit = parseInt(limit)
  } catch (e) {
    limit = 100
  }

  const query = _.trim(req.query.q || '')
  if (!query) return res.send({ took: 0, timed_out: false, hits: { total: { value: 0, relation: 'eq' }, hits: [] } })

  const getGroups = () =>
    new Promise((resolve, reject) => {
      if (!req.user.role.isAdmin && !req.user.role.isAgent) {
        return groupSchema.getAllGroupsOfUserNoPopulate(req.user._id, function (err, groups) {
          if (err) return reject(err)
          return resolve(groups)
        })
      }

      const Department = require('../../../models/department')
      return Department.getDepartmentGroupsOfUser(req.user._id, function (err, groups) {
        if (err) return reject(err)
        return resolve(groups)
      })
    })

  ;(async () => {
    try {
      await es.checkConnection()

      const groups = await getGroups()
      const g = _.map(groups, function (i) {
        return i._id
      })

      // For docker we need to add a unique ID for the index.
      const obj = {
        index: es.indexName,
        body: {
          size: limit,
          from: 0,
          query: {
            bool: {
              must: {
                multi_match: {
                  query,
                  type: 'cross_fields',
                  operator: 'and',
                  fields: [
                    'uid^5',
                    'subject^5',
                    'subject.stemmed^5',
                    'issue^5',
                    'issue.stemmed^5',
                    'owner.fullname',
                    'owner.username',
                    'owner.email',
                    'comments.owner.email',
                    'tags.normalized',
                    'priority.name',
                    'ticketType.name',
                    'typeTicket.name',
                    'type.name',
                    'group.name',
                    'comments.comment^3',
                    'comments.comment.stemmed^3',
                    'notes.note^3',
                    'notes.note.stemmed^3',
                    'dateFormatted'
                  ],
                  tie_breaker: 0.3
                }
              },
              filter: {
                terms: { 'group._id': g }
              }
            }
          }
        }
      }

      const result = await es.esclient.search(obj)

      return res.send(result)
    } catch (err) {
      winston.warn(err)

      const statusCode = err?.meta?.statusCode || 500
      const errorType = err?.meta?.body?.error?.type
      const errorReason = err?.meta?.body?.error?.reason

      if (errorType === 'index_not_found_exception') {
        return apiUtil.sendApiError(
          res,
          404,
          `Elasticsearch index "${es.indexName}" was not found. Rebuild the index in Settings > Elasticsearch.`
        )
      }

      if (err.message === 'Elasticsearch client not initialized. Restart Trudesk!') {
        return apiUtil.sendApiError(res, 400, 'Elasticsearch is not configured')
      }

      return apiUtil.sendApiError(res, statusCode, errorReason || err.message)
    }
  })()
}

module.exports = apiElasticSearch
