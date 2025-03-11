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
 *  Updated:    4/8/19 1:00 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

const apiUtils = require('../apiUtils')
const Ticket = require('../../../models/ticket')
const Group = require('../../../models/group')
const Department = require('../../../models/department')
const winston = require('./../../../logger')

const apiGroups = {}

apiGroups.create = function (req, res) {
  const postGroup = req.body
  if (!postGroup) return apiUtils.sendApiError_InvalidPostData(res)

  Group.create(postGroup, function (err, group) {
    if (err) return apiUtils.sendApiError(res, 500, err.message)

    group.populate('members sendMailTo', function (err, group) {
      if (err) return apiUtils.sendApiError(res, 500, err.message)

      return apiUtils.sendApiSuccess(res, { group })
    })
  })
}

apiGroups.get = function (req, res) {
  const limit = Number(req.query.limit) || 50
  const page = Number(req.query.page) || 0
  const type = req.query.type || 'user'

  if (type === 'all') {
    Group.getWithObject({ limit, page }, function (err, groups) {
      if (err) return apiUtils.sendApiError(res, 500, err.message)

      return apiUtils.sendApiSuccess(res, { groups, count: groups.length })
    })
  } else {
    if (req.user.role.isAdmin || req.user.role.isAgent) {
      Department.getDepartmentGroupsOfUser(req.user._id, function (err, groups) {
        if (err) return apiUtils.sendApiError(res, 500, err.message)

        return apiUtils.sendApiSuccess(res, { groups, count: groups.length })
      })
    } else {
      Group.getAllGroupsOfUser(req.user._id, function (err, groups) {
        if (err) return apiUtils.sendApiError(res, 500, err.message)

        return apiUtils.sendApiSuccess(res, { groups, count: groups.length })
      })
    }
  }
}

apiGroups.update = function (req, res) {
  const id = req.params.id
  if (!id) return apiUtils.sendApiError(res, 400, 'Invalid Group Id')

  const putData = req.body
  if (!putData) return apiUtils.sendApiError_InvalidPostData(res)

  Group.findOne({ _id: id }, function (err, group) {
    if (err || !group) return apiUtils.sendApiError(res, 400, 'Invalid Group')

    if (putData.name) group.name = putData.name
    if (putData.members) group.members = putData.members
    if (putData.sendMailTo) group.sendMailTo = putData.sendMailTo

    group.save(function (err, group) {
      if (err) return apiUtils.sendApiError(res, 500, err.message)

      group.populate('members sendMailTo', function (err, group) {
        if (err) return apiUtils.sendApiError(res, 500, err.message)

        winston.info(`The group was updated : ${group.name} : ${JSON.stringify(group.members)}`)

        return apiUtils.sendApiSuccess(res, { group })
      })
    })
  })
}

apiGroups.delete = function (req, res) {
  const id = req.params.id
  if (!id) return apiUtils.sendApiError_InvalidPostData(res)

  Ticket.countDocuments({ group: { $in: [id] } }, function (err, tickets) {
    if (err) return apiUtils.sendApiError(res, 500, err.message)
    if (tickets > 0) return apiUtils.sendApiError(res, 400, 'Unable to delete group with tickets.')

    Group.deleteOne({ _id: id }, function (err, success) {
      if (err) return apiUtils.sendApiError(res, 500, err.message)
      if (!success) return apiUtils.sendApiError(res, 500, 'Unable to delete group. Contact your administrator.')

      return apiUtils.sendApiSuccess(res, { _id: id })
    })
  })
}

module.exports = apiGroups
