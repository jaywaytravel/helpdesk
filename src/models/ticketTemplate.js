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
const mongoose = require('mongoose')
const utils = require('../helpers/utils')

const COLLECTION = 'tickettemplates'

// Needed for Population
require('./ticketpriority')

/**
 * TicketType Schema
 * @module models/tickettype
 * @class TicketType

 *
 * @property {object} _id ```Required``` ```unique``` MongoDB Object ID
 * @property {String} name ```Required``` ```unique``` Name of Ticket Type
 */
const ticketType2Schema = mongoose.Schema({
  name: { type: String, required: true, unique: true },
  text: { type: String }
})

ticketType2Schema.pre('save', function (next) {
  this.name = utils.sanitizeFieldPlainText(this.name.trim())

  return next()
})

/**
 * Return all Ticket Types
 *
 * @memberof TicketType
 * @static
 * @method getTypes
 *
 * @param {QueryCallback} callback MongoDB Query Callback
 */
ticketType2Schema.statics.getTypes = function (callback) {
  const q = this.model(COLLECTION).find({})

  return q.exec(callback)
}

/**
 * Return Single Ticket Types
 *
 * @memberof TicketType
 * @static
 * @method getType
 *
 * @param {String} id Object Id of ticket type
 * @param {QueryCallback} callback MongoDB Query Callback
 */
ticketType2Schema.statics.getType = function (id, callback) {
  const q = this.model(COLLECTION).findOne({ _id: id })

  return q.exec(callback)
}

/**
 * Return Single Ticket Type based on given type name
 *
 * @memberof TicketType
 * @static
 * @method getTypeByName
 *
 * @param {String} name Name of Ticket Type to search for
 * @param {QueryCallback} callback MongoDB Query Callback
 */
ticketType2Schema.statics.getTypeByName = function (name, callback) {
  const q = this.model(COLLECTION).findOne({ name })

  return q.exec(callback)
}

ticketType2Schema.methods.addPriority = function (priorityId, callback) {
  if (!priorityId) return callback({ message: 'Invalid Priority Id' })

  const self = this

  if (!_.isArray(self.priorities)) {
    self.priorities = []
  }

  self.priorities.push(priorityId)

  return callback(null, self)
}

ticketType2Schema.methods.removePriority = function (priorityId, callback) {
  if (!priorityId) return callback({ message: 'Invalid Priority Id' })

  const self = this

  self.priorities = _.reject(self.priorities, function (p) {
    return p._id.toString() === priorityId.toString()
  })

  return callback(null, self)
}

module.exports = mongoose.model(COLLECTION, ticketType2Schema)
