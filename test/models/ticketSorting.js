/* eslint-disable no-unused-expressions */
/* globals describe, it, before, after */
const expect = require('chai').expect
const mongoose = require('mongoose')
const ticketSchema = require('../../src/models/ticket')
const groupSchema = require('../../src/models/group')
const statusSchema = require('../../src/models/ticketStatus')

describe('ticket status and activity sorting', function () {
  let group
  let newStatus
  let openStatus
  const ticketUids = [990001, 990002, 990003, 990004]

  before(async function () {
    group = await groupSchema.findOne({ name: 'TEST' })
    newStatus = await statusSchema.findOne({ uid: 0 })
    openStatus = await statusSchema.findOne({ uid: 1 })

    await statusSchema.updateOne({ _id: openStatus._id }, { $set: { order: 0 } })
    await statusSchema.updateOne({ _id: newStatus._id }, { $set: { order: 1 } })

    const owner = new mongoose.Types.ObjectId()
    await ticketSchema.collection.insertMany([
      {
        uid: 990001,
        owner,
        group: group._id,
        status: openStatus._id,
        date: new Date('2026-01-01T00:00:00.000Z'),
        updated: new Date('2026-01-04T00:00:00.000Z'),
        deleted: false,
        subject: 'Sorting test updated tie lower uid',
        issue: 'Sorting test'
      },
      {
        uid: 990002,
        owner,
        group: group._id,
        status: openStatus._id,
        date: new Date('2026-01-03T00:00:00.000Z'),
        deleted: false,
        subject: 'Sorting test date fallback',
        issue: 'Sorting test'
      },
      {
        uid: 990003,
        owner,
        group: group._id,
        status: openStatus._id,
        date: new Date('2026-01-02T00:00:00.000Z'),
        updated: new Date('2026-01-04T00:00:00.000Z'),
        deleted: false,
        subject: 'Sorting test updated tie higher uid',
        issue: 'Sorting test'
      },
      {
        uid: 990004,
        owner,
        group: group._id,
        status: newStatus._id,
        date: new Date('2026-01-10T00:00:00.000Z'),
        deleted: false,
        subject: 'Sorting test later status',
        issue: 'Sorting test'
      }
    ])
  })

  after(async function () {
    await ticketSchema.deleteMany({ uid: { $in: ticketUids } })
    await statusSchema.updateOne({ _id: newStatus._id }, { $set: { order: 0 } })
    await statusSchema.updateOne({ _id: openStatus._id }, { $set: { order: 1 } })
  })

  it('sorts by configured status order, activity date and uid', async function () {
    const tickets = await ticketSchema.getTicketsWithObject([group._id], {
      limit: -1,
      page: 0,
      status: [newStatus._id.toString(), openStatus._id.toString()],
      sortByStatusOrder: true
    })

    expect(tickets.map(ticket => ticket.uid)).to.deep.equal([990003, 990001, 990002, 990004])
  })

  it('applies pagination after status and activity sorting', async function () {
    const tickets = await ticketSchema.getTicketsWithObject([group._id], {
      limit: 2,
      page: 1,
      status: [newStatus._id.toString(), openStatus._id.toString()],
      sortByStatusOrder: true
    })

    expect(tickets.map(ticket => ticket.uid)).to.deep.equal([990002, 990004])
  })
})
