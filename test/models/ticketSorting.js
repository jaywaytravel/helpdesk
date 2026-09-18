/* eslint-disable no-unused-expressions */
/* globals describe, it, before, after */
const expect = require('chai').expect
const mongoose = require('mongoose')
const ticketSchema = require('../../src/models/ticket')
const groupSchema = require('../../src/models/group')
const statusSchema = require('../../src/models/ticketStatus')

describe('ticket default priority and column sorting', function () {
  let group
  let newStatus
  let openStatus
  let pendingStatus
  let originalNewDefaultSortPriority
  let originalOpenDefaultSortPriority
  let originalPendingDefaultSortPriority
  const ticketUids = [990001, 990002, 990003, 990004, 990005]

  before(async function () {
    group = await groupSchema.findOne({ name: 'TEST' })
    newStatus = await statusSchema.findOne({ uid: 0 })
    openStatus = await statusSchema.findOne({ uid: 1 })
    pendingStatus = await statusSchema.findOne({ uid: 2 })
    originalNewDefaultSortPriority = newStatus.defaultSortPriority
    originalOpenDefaultSortPriority = openStatus.defaultSortPriority
    originalPendingDefaultSortPriority = pendingStatus.defaultSortPriority

    await statusSchema.updateOne({ _id: openStatus._id }, { $set: { order: 0, defaultSortPriority: 1 } })
    await statusSchema.updateOne({ _id: newStatus._id }, { $set: { order: 1, defaultSortPriority: 3 } })
    await statusSchema.updateOne({ _id: pendingStatus._id }, { $set: { order: 2, defaultSortPriority: 2 } })

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
      },
      {
        uid: 990005,
        owner,
        group: group._id,
        status: pendingStatus._id,
        date: new Date('2026-01-20T00:00:00.000Z'),
        deleted: false,
        subject: 'Sorting test middle priority',
        issue: 'Sorting test'
      }
    ])
  })

  after(async function () {
    await ticketSchema.deleteMany({ uid: { $in: ticketUids } })
    await statusSchema.updateOne(
      { _id: newStatus._id },
      { $set: { order: 0, defaultSortPriority: originalNewDefaultSortPriority } }
    )
    await statusSchema.updateOne(
      { _id: openStatus._id },
      { $set: { order: 1, defaultSortPriority: originalOpenDefaultSortPriority } }
    )
    await statusSchema.updateOne(
      { _id: pendingStatus._id },
      { $set: { order: 2, defaultSortPriority: originalPendingDefaultSortPriority } }
    )
  })

  it('sorts status priority levels before sorting each level by creation date', async function () {
    const tickets = await ticketSchema.getTicketsWithObject([group._id], {
      limit: -1,
      page: 0,
      status: [newStatus._id.toString(), openStatus._id.toString(), pendingStatus._id.toString()],
      sortByDefaultPriority: true
    })

    expect(tickets.map(ticket => ticket.uid)).to.deep.equal([990002, 990003, 990001, 990005, 990004])
  })

  it('applies pagination after default priority and creation-date sorting', async function () {
    const tickets = await ticketSchema.getTicketsWithObject([group._id], {
      limit: 2,
      page: 1,
      status: [newStatus._id.toString(), openStatus._id.toString(), pendingStatus._id.toString()],
      sortByDefaultPriority: true
    })

    expect(tickets.map(ticket => ticket.uid)).to.deep.equal([990001, 990005])
  })

  it('sorts a ticket column before applying pagination', async function () {
    const firstPage = await ticketSchema.getTicketsWithObject([group._id], {
      limit: 2,
      page: 0,
      status: [newStatus._id.toString(), openStatus._id.toString()],
      sortBy: 'subject',
      sortDirection: 'asc'
    })
    const secondPage = await ticketSchema.getTicketsWithObject([group._id], {
      limit: 2,
      page: 1,
      status: [newStatus._id.toString(), openStatus._id.toString()],
      sortBy: 'subject',
      sortDirection: 'asc'
    })

    expect(firstPage.map(ticket => ticket.uid)).to.deep.equal([990002, 990004])
    expect(secondPage.map(ticket => ticket.uid)).to.deep.equal([990003, 990001])
  })

  it('sorts configured statuses in descending order when explicitly selected', async function () {
    const tickets = await ticketSchema.getTicketsWithObject([group._id], {
      limit: -1,
      page: 0,
      status: [newStatus._id.toString(), openStatus._id.toString()],
      sortBy: 'status',
      sortDirection: 'desc'
    })

    expect(tickets.map(ticket => ticket.uid)).to.deep.equal([990004, 990003, 990001, 990002])
  })
})
