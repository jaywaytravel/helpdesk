/* eslint-disable no-unused-expressions */
/* globals describe, it, after */
const expect = require('chai').expect
const statusSchema = require('../../src/models/ticketStatus')
const ticketController = require('../../src/controllers/api/v1/tickets')

describe('ticket status API', function () {
  this.timeout(10000)

  let createdStatusId

  after(async function () {
    if (createdStatusId) await statusSchema.deleteOne({ _id: createdStatusId })
  })

  it('adds a new status at the end of the configured order', async function () {
    const response = await new Promise(resolve => {
      const res = {
        statusCode: 200,
        status: function (statusCode) {
          this.statusCode = statusCode
          return this
        },
        json: function (body) {
          resolve({ statusCode: this.statusCode, body })
        }
      }

      ticketController.createStatus(
        { body: { name: 'Sorting Test Status', htmlColor: '#123456' } },
        res
      )
    })

    expect(response.statusCode).to.equal(200)
    expect(response.body.success).to.be.true
    expect(response.body.status).to.exist
    expect(response.body.status.order).to.equal(4)
    expect(response.body.status.defaultSortPriority).to.equal(1)
    createdStatusId = response.body.status._id
  })

  it('updates a status default sort priority', async function () {
    const response = await new Promise(resolve => {
      const res = {
        statusCode: 200,
        status: function (statusCode) {
          this.statusCode = statusCode
          return this
        },
        json: function (body) {
          resolve({ statusCode: this.statusCode, body })
        }
      }

      ticketController.updateStatus({ params: { id: createdStatusId }, body: { defaultSortPriority: 3 } }, res)
    })

    expect(response.statusCode).to.equal(200)
    expect(response.body.success).to.be.true
    expect(response.body.status.defaultSortPriority).to.equal(3)
  })

  it('rejects an invalid default sort priority', async function () {
    const response = await new Promise(resolve => {
      const res = {
        statusCode: 200,
        status: function (statusCode) {
          this.statusCode = statusCode
          return this
        },
        json: function (body) {
          resolve({ statusCode: this.statusCode, body })
        }
      }

      ticketController.updateStatus({ params: { id: createdStatusId }, body: { defaultSortPriority: 1.5 } }, res)
    })

    expect(response.statusCode).to.equal(400)
    expect(response.body.success).to.be.false
  })
})
