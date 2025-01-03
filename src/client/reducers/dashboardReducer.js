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
 *  Updated:    7/1/22 12:16 AM
 *  Copyright (c) 2014-2022. Trudesk, Inc (Chris Brame) All rights reserved.
 */

import { fromJS, List } from 'immutable'
import { handleActions } from 'redux-actions'
import { sortBy, map } from 'lodash'
import {
  FETCH_DASHBOARD_DATA,
  FETCH_DASHBOARD_OVERDUE_TICKETS,
  FETCH_DASHBOARD_TOP_GROUPS,
  FETCH_DASHBOARD_TOP_TAGS,
  FETCH_COUNT_BY_TYPE,
  FETCH_TOTAL_TICKETS_THIS_MONTH,
  FETCH_TOTAL_TICKETS_LAST_MONTH,
  FETCH_CLOSED_OR_REJECTED_LAST_MONTH,
  FETCH_TICKETS_BY_STATUS_LAST_MONTH,
  FETCH_AVERAGE_RESOLUTION_TIME
} from 'actions/types'

const initialState = {
  loading: false,
  lastUpdated: null,
  ticketBreakdownData: List([]),
  mostActiveTicket: null,
  mostAssignee: null,
  mostCommenter: null,
  mostRequester: null,
  ticketAvg: null,
  ticketCount: 0,
  closedCount: 0,
  totalTicketsThisMonth: 0,
  totalTicketsLastMonth: 0,

  avgResolutionTime: null,

  loadingTopGroups: false,
  topGroups: List([]),

  loadingTopTags: false,
  topTags: List([]),

  loadingOverdueTickets: false,
  overdueTickets: List([]),

  
  closedOrRejectedLastMonth: List([]),
  loadingClosedOrRejectedLastMonth: false,

  ticketsByStatusLastMonth: List([]),
  loadingTicketsByStatusLastMonth: false,
  
  countByType: List([]),
  loadingCountByType: false,
}

const reducer = handleActions(
  {
    [FETCH_DASHBOARD_DATA.PENDING]: state => {
      return { ...state, loading: true }
    },

    [FETCH_DASHBOARD_DATA.SUCCESS]: (state, action) => {
      return {
        ...state,
        tickets: fromJS(action.response.tickets),
        loading: false,
        lastUpdated: action.response.lastUpdated,
        ticketBreakdownData: fromJS(action.response.data),
        mostActiveTicket: fromJS(action.response.mostActiveTicket),
        mostCommenter: fromJS(action.response.mostCommenter),
        mostRequester: fromJS(action.response.mostRequester),
        mostAssignee: fromJS(action.response.mostAssignee),
        ticketAvg: fromJS(action.response.ticketAvg),
        ticketCount: action.response.ticketCount,
        closedCount: action.response.closedCount
      }
    },

    [FETCH_DASHBOARD_TOP_GROUPS.PENDING]: state => {
      return {
        ...state, 
        loadingTopGroups: true 
      }
    },

    [FETCH_DASHBOARD_TOP_GROUPS.SUCCESS]: (state, action) => {
      const items = action.response.items
      let top5 = sortBy(items, i => i.count)
        .reverse()
        .slice(0, 5)

      top5 = map(top5, v => [v.name, v.count])

      return {
        ...state,
        loadingTopGroups: false,
        topGroups: fromJS(top5)
      }
    },

    [FETCH_DASHBOARD_TOP_TAGS.PENDING]: state => {
      return {
        ...state,
        loadingTopTags: true
      }
    },

    [FETCH_DASHBOARD_TOP_TAGS.SUCCESS]: (state, action) => {
      const items = action.response.tags
      const topTags = map(items, (v, k) => [k, v])
      return {
        ...state,
        loadingTopTags: false,
        topTags: fromJS(topTags)
      }
    },

    [FETCH_DASHBOARD_OVERDUE_TICKETS.PENDING]: state => {
      return {
        ...state,
        loadingOverdueTickets: true
      }
    },

    [FETCH_DASHBOARD_OVERDUE_TICKETS.SUCCESS]: (state, action) => {
      if (action.response.success && action.response.error) {
        return { ...state, loadingOverdueTickets: false, overdueTickets: initialState.overdueTickets }
      }

      return {
        ...state,
        loadingOverdueTickets: false,
        overdueTickets: fromJS(action.response.tickets)
      }
    },

    [FETCH_COUNT_BY_TYPE.PENDING]: state => {
      return { ...state, loadingCountByType: true }
    },

    [FETCH_COUNT_BY_TYPE.SUCCESS]: (state, action) => {
      let result = sortBy(action.response, i => i.count)
        .reverse()

      result = map(result, v => [v._id, v.count])

      return { ...state, loadingCountByType: false, countByType: fromJS(result) }
    },

    [FETCH_TOTAL_TICKETS_THIS_MONTH.PENDING]: state => {
      return { ...state, loading: true }
    },

    [FETCH_TOTAL_TICKETS_THIS_MONTH.SUCCESS]: (state, action) => {
      return { ...state, totalTicketsThisMonth: action.response.count }
    },

    [FETCH_TOTAL_TICKETS_LAST_MONTH.PENDING]: state => {
      return { ...state, loading: true }
    },

    [FETCH_TOTAL_TICKETS_LAST_MONTH.SUCCESS]: (state, action) => {
      return { ...state, totalTicketsLastMonth: action.response.count }
    },

    [FETCH_CLOSED_OR_REJECTED_LAST_MONTH.PENDING]: state => {
      return { ...state, loadingClosedOrRejectedLastMonth: true }
    },

    [FETCH_CLOSED_OR_REJECTED_LAST_MONTH.SUCCESS]: (state, action) => {
      let result = sortBy(action.response, i => i.count)
        .reverse()

      result = map(result, v => [v._id, v.count])

      return { ...state, loadingClosedOrRejectedLastMonth: false, closedOrRejectedLastMonth: fromJS(result) }
    },

    [FETCH_TICKETS_BY_STATUS_LAST_MONTH.PENDING]: state => {
      return { ...state, loadingTicketsByStatusLastMonth: true }
    },

    [FETCH_TICKETS_BY_STATUS_LAST_MONTH.SUCCESS]: (state, action) => {
      let result = sortBy(action.response, i => i.count)
        .reverse()

      result = map(result, v => [v._id, v.count])


      return { ...state, loadingTicketsByStatusLastMonth: false, ticketsByStatusLastMonth: fromJS(result) }
    },

    [FETCH_AVERAGE_RESOLUTION_TIME.PENDING]: state => {
      return { ...state, loading: true }
    },

    [FETCH_AVERAGE_RESOLUTION_TIME.SUCCESS]: (state, action) => {
      return { ...state, avgResolutionTime: action.response.avgResolutionTime }
    },
  },
  initialState
)

export default reducer
