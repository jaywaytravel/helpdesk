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
 *  Updated:    4/1/19 2:02 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import { fromJS, List } from 'immutable'
import { handleActions } from 'redux-actions'
import isUndefined from 'lodash/isUndefined'
import {
  CREATE_TICKET,
  FETCH_TICKETS,
  TICKET_UPDATED,
  UNLOAD_TICKETS,
  DELETE_TICKET,
  TICKET_EVENT,
  FETCH_TICKET_TYPES,
  FETCH_PRIORITIES,
  FETCH_STATUS
} from 'actions/types'

const initialState = {
  tickets: List([]),
  ticketStatuses: List([]),
  loadingTicketTypes: false,
  types: List([]),
  priorities: List([]),
  totalCount: '',
  viewType: 'active',
  sortBy: null,
  loading: false,
  currentPage: null,
  nextPage: 1,
  prevPage: 0,
  forms: List([])
}

// Util function until custom views are finished
function hasInView (state, view, statusId, assignee, userId, userGroupIds, groupId) {
  let hasView = false
  let hasGroup = false
  const unresolvedStatuses = state.ticketStatuses.filter(i => i.get('isResolved') === false)

  switch (view) {
    case 'filter':
      hasView = true
      break
    case 'all':
      hasView = state.ticketStatuses.findIndex(s => s.get('_id') === statusId) !== -1
      break
    case 'active':
      hasView = unresolvedStatuses.findIndex(s => s.get('_id') === statusId) !== -1
      break
    case 'assigned':
      hasView = assignee === userId
      break
    case 'unassigned':
      hasView = isUndefined(assignee)
      break
    default:
      hasView = false
  }

  if (isUndefined(userGroupIds) || isUndefined(groupId)) hasGroup = false
  else hasGroup = userGroupIds.indexOf(groupId) !== -1

  return hasGroup && hasView
}

function sortTicketsByStatusAndActivity (tickets, statuses) {
  if (statuses.size === 0) return tickets

  const getStatusId = ticket => {
    const status = ticket.get('status')
    return status && typeof status.get === 'function' ? status.get('_id') : status
  }

  const getStatusOrder = ticket => {
    const statusId = getStatusId(ticket)
    const statusIndex = statuses.findIndex(status => status.get('_id') === statusId)
    if (statusIndex === -1) return Number.MAX_SAFE_INTEGER

    const status = statuses.get(statusIndex)
    const order = status.get('order')
    if (Number.isFinite(order)) return order

    const uid = status.get('uid')
    return Number.isFinite(uid) ? uid : Number.MAX_SAFE_INTEGER
  }

  const getActivityDate = ticket => {
    const value = ticket.get('updated') || ticket.get('date')
    const timestamp = value ? new Date(value).getTime() : 0
    return Number.isNaN(timestamp) ? 0 : timestamp
  }

  return tickets.sort((left, right) => {
    const statusDifference = getStatusOrder(left) - getStatusOrder(right)
    if (statusDifference !== 0) return statusDifference

    const activityDifference = getActivityDate(right) - getActivityDate(left)
    if (activityDifference !== 0) return activityDifference

    return right.get('uid') - left.get('uid')
  })
}

const reducer = handleActions(
  {
    [FETCH_TICKETS.PENDING]: (state, action) => {
      return {
        ...state,
        viewType: action.payload.type,
        sortBy: action.payload.sortBy || null,
        currentPage: Number(action.payload.page || 0),
        loading: true
      }
    },

    [FETCH_TICKETS.SUCCESS]: (state, action) => {
      const tickets = fromJS(action.response.tickets || [])
      return {
        ...state,
        tickets:
          state.viewType === 'active' && !state.sortBy
            ? sortTicketsByStatusAndActivity(tickets, state.ticketStatuses)
            : tickets,
        currentPage: Number(action.response.page || 0),
        prevPage: fromJS(action.response.prevPage),
        nextPage: fromJS(action.response.nextPage),
        totalCount: action.response.totalCount
          ? fromJS(action.response.totalCount.toString())
          : action.response.tickets.length.toString(),
        loading: false
      }
    },

    [FETCH_TICKETS.ERROR]: state => {
      return {
        ...state,
        loading: false
      }
    },

    [CREATE_TICKET.SUCCESS]: state => {
      // This is handle with a socket.io event...
      return { ...state }
    },

    [DELETE_TICKET.SUCCESS]: (state, action) => {
      const idx = state.tickets.findIndex(ticket => {
        return ticket.get('_id').toString() === action.payload.id.toString()
      })

      if (idx === -1) return { ...state }

      return {
        ...state,
        tickets: state.tickets.delete(idx)
      }
    },

    [TICKET_EVENT.SUCCESS]: (state, action) => {
      const type = action.payload.type
      switch (type) {
        case 'created': {
          const ticket = action.payload.data
          const tickets = state.tickets.insert(0, fromJS(ticket))
          return {
            ...state,
            tickets:
              state.viewType === 'active' ? sortTicketsByStatusAndActivity(tickets, state.ticketStatuses) : tickets
          }
        }
        case 'deleted': {
          const id = action.payload.data
          const idx = state.tickets.findIndex(ticket => {
            return ticket.get('_id').toString() === id.toString()
          })
          if (idx === -1) return { ...state }

          return {
            ...state,
            tickets: state.tickets.delete(idx)
          }
        }
        default:
          return {
            ...state
          }
      }
    },

    [TICKET_UPDATED.SUCCESS]: (state, action) => {
      const ticket = action.payload.ticket
      const userGroupIds = action.sessionUser.groups

      const idx = state.tickets.findIndex(t => {
        return t.get('_id') === ticket._id
      })

      ticket.status = state.ticketStatuses.find(i => i.get('_id') === ticket.status)

      const inView = hasInView(
        state,
        state.viewType,
        ticket.status.get('_id'),
        ticket.assignee ? ticket.assignee._id : undefined,
        action.sessionUser._id,
        userGroupIds,
        ticket.group._id
      )

      if (!inView && idx !== -1) {
        return {
          ...state,
          tickets: state.tickets.delete(idx)
        }
      }

      if (!inView) return { ...state }

      if (idx === -1) {
        const withTicket = state.tickets.push(fromJS(ticket))
        return {
          ...state,
          tickets:
            state.viewType === 'active'
              ? sortTicketsByStatusAndActivity(withTicket, state.ticketStatuses)
              : withTicket.sortBy(t => -t.get('uid'))
        }
      }

      const tickets = state.tickets.set(idx, fromJS(ticket))
      return {
        ...state,
        tickets: state.viewType === 'active' ? sortTicketsByStatusAndActivity(tickets, state.ticketStatuses) : tickets
      }
    },

    [UNLOAD_TICKETS.SUCCESS]: state => {
      return {
        ...state,
        tickets: state.tickets.clear(),
        loading: false
      }
    },

    [FETCH_TICKET_TYPES.PENDING]: state => {
      return {
        ...state,
        loadingTicketTypes: true
      }
    },

    [FETCH_TICKET_TYPES.SUCCESS]: (state, action) => {
      return {
        ...state,
        loadingTicketTypes: false,
        types: fromJS(action.response.ticketTypes),
        priorities: fromJS(action.response.priorities)
      }
    },

    [FETCH_STATUS.PENDING]: state => {
      return {
        ...state
      }
    },

    [FETCH_STATUS.SUCCESS]: (state, action) => {
      const ticketStatuses = fromJS(action.response.status)
      return {
        ...state,
        ticketStatuses,
        tickets:
          state.viewType === 'active' && !state.sortBy
            ? sortTicketsByStatusAndActivity(state.tickets, ticketStatuses)
            : state.tickets
      }
    },

    [FETCH_PRIORITIES.SUCCESS]: (state, action) => {
      return {
        ...state,
        priorities: fromJS(action.response.priorities)
      }
    }
  },
  initialState
)

export default reducer
