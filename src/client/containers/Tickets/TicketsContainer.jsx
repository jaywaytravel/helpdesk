/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Updated:    6/9/19 9:44 PM
 *  Copyright (c) 2014-2019 Trudesk, Inc. All rights reserved.
 */

import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { observer } from 'mobx-react'
import { makeObservable, observable } from 'mobx'
import { each, without, uniq } from 'lodash'

import Log from '../../logger'
import axios from 'axios'
import {
  fetchTickets,
  deleteTicket,
  ticketEvent,
  unloadTickets,
  ticketUpdated,
  fetchTicketStatus
} from 'actions/tickets'
import { fetchSearchResults } from 'actions/search'
import { showModal } from 'actions/common'

import PageTitle from 'components/PageTitle'
import Table from 'components/Table'
import TableHeader from 'components/Table/TableHeader'
import TableRow from 'components/Table/TableRow'
import TitlePagination from 'components/TitlePagination'
import PageContent from 'components/PageContent'
import TableCell from 'components/Table/TableCell'
import PageTitleButton from 'components/PageTitleButton'
import DropdownTrigger from 'components/Dropdown/DropdownTrigger'
import Dropdown from 'components/Dropdown'
import DropdownItem from 'components/Dropdown/DropdownItem'
import DropdownSeparator from 'components/Dropdown/DropdownSeperator'

import helpers from 'lib/helpers'
import anime from 'animejs'
import moment from 'moment-timezone'
import SearchResults from 'components/SearchResults'

@observer
class TicketsContainer extends React.Component {
  @observable searchTerm = ''

  selectedTickets = []
  constructor (props) {
    super(props)
    makeObservable(this)

    this.state = {
      sortBy: null,
      sortDirection: null
    }

    this.onTicketCreated = this.onTicketCreated.bind(this)
    this.onTicketUpdated = this.onTicketUpdated.bind(this)
    this.onTicketDeleted = this.onTicketDeleted.bind(this)
    this.loadTickets = this.loadTickets.bind(this)
    this.onPageChange = this.onPageChange.bind(this)
    this.onSort = this.onSort.bind(this)
  }

  componentDidMount () {
    this.props.socket.on('$trudesk:client:ticket:created', this.onTicketCreated)
    this.props.socket.on('$trudesk:client:ticket:updated', this.onTicketUpdated)
    this.props.socket.on('$trudesk:client:ticket:deleted', this.onTicketDeleted)

    this.loadTickets(this.props.currentPage)
    this.props.fetchTicketStatus()
  }

  componentDidUpdate () {
    if (this.timeline) {
      this.timeline.pause()
      this.timeline.seek(0)
    }

    anime.remove('tr.overdue td')

    this.timeline = anime.timeline({
      direction: 'alternate',
      duration: 800,
      autoPlay: false,
      easing: 'steps(1)',
      loop: true,
      backgroundColor: 'blue'
    })

    this.timeline.add({
      targets: 'tr.overdue td',
      backgroundColor: '#b71c1c',
      color: '#ffffff'
    })

    this.timeline.play()
  }

  componentWillUnmount () {
    anime.remove('tr.overdue td')
    this.timeline = null
    this.props.unloadTickets()
    this.props.socket.off('$trudesk:client:ticket:created', this.onTicketCreated)
    this.props.socket.off('$trudesk:client:ticket:updated', this.onTicketUpdated)
    this.props.socket.off('$trudesk:client:ticket:deleted', this.onTicketDeleted)
  }

  loadTickets (page) {
    const nextPage = Number(page)

    this.props.fetchTickets({
      limit: 200,
      page: Number.isNaN(nextPage) ? 0 : nextPage,
      type: this.props.view,
      filter: this.props.filter,
      sortBy: this.state.sortBy,
      sortDirection: this.state.sortDirection
    })
  }

  onTicketCreated (ticket) {
    if (this.state.sortBy) return this.loadTickets(this.props.currentPage)
    if (this.props.currentPage === 0) this.props.ticketEvent({ type: 'created', data: ticket })
  }

  onTicketUpdated (data) {
    if (this.state.sortBy) return this.loadTickets(this.props.currentPage)
    this.props.ticketUpdated(data)
  }

  onTicketDeleted (id) {
    if (this.state.sortBy) return this.loadTickets(this.props.currentPage)
    this.props.ticketEvent({ type: 'deleted', data: id })
  }

  onSort (sortBy) {
    let sortDirection = 'asc'
    if (this.state.sortBy === sortBy && this.state.sortDirection === 'asc') sortDirection = 'desc'
    else if (this.state.sortBy === sortBy && this.state.sortDirection === 'desc') {
      sortBy = null
      sortDirection = null
    }

    this.setState({ sortBy, sortDirection }, () => this.loadTickets(0))
  }

  onTicketCheckChanged (e, id) {
    if (e.target.checked) this.selectedTickets.push(id)
    else this.selectedTickets = without(this.selectedTickets, id)

    this.selectedTickets = uniq(this.selectedTickets)
  }

  onSetStatus (status) {
    const batch = this.selectedTickets.map(id => {
      return { id, status: status.get('_id') }
    })

    axios
      .put(`/api/v2/tickets/batch`, { batch })
      .then(res => {
        if (res.data.success) {
          helpers.UI.showSnackbar({ text: `Ticket status set to ${status.get('name')}` })
          this._clearChecked()
        } else {
          helpers.UI.showSnackbar('An unknown error occurred.', true)
          Log.error(res.data.error)
        }
      })
      .catch(error => {
        Log.error(error)
        helpers.UI.showSnackbar('An Error occurred. Please check console.', true)
      })
  }

  onDeleteClicked () {
    each(this.selectedTickets, id => {
      this.props.deleteTicket({ id })
    })

    this._clearChecked()
  }

  onSearchTermChanged (e) {
    this.searchTerm = e.target.value
    if (this.searchTerm.length > 3) {
      SearchResults.toggleAnimation(true, true)
      this.props.fetchSearchResults({ term: this.searchTerm })
    } else {
      SearchResults.toggleAnimation(true, false)
    }
  }

  _onSearchFocus (e) {
    if (this.searchTerm.length > 3) SearchResults.toggleAnimation(true, true)
  }

  onSearchKeypress (e) {
    if (this.searchTerm.length > 3) this.props.fetchSearchResults({ term: this.searchTerm })

    // e.persist()
    // if (e.charCode === 13) {
    //   const searchString = e.target.value
    //   if (searchString.length < 1) this.props.unloadTickets().then(this.props.fetchTickets({ type: this.props.view }))
    //   else this.props.unloadTickets().then(this.props.fetchTickets({ type: 'search', searchString }))
    // }
  }

  _selectAll () {
    this.selectedTickets = []
    const checkboxes = this.ticketsTable.querySelectorAll('td > input[type="checkbox"]')
    checkboxes.forEach(item => {
      this.selectedTickets.push(item.dataset.ticket)
      item.checked = true
    })

    this.selectedTickets = uniq(this.selectedTickets)
  }

  _clearChecked () {
    this.selectedTickets = []
    const checkboxes = this.ticketsTable.querySelectorAll('td > input[type="checkbox"]')
    checkboxes.forEach(item => {
      item.checked = false
    })

    this.selectAllCheckbox.checked = false
  }

  onSelectAll (e) {
    if (e.target.checked) this._selectAll()
    else this._clearChecked()
  }

  onPageChange (page, href) {
    const nextPage = Number(page)
    if (Number.isNaN(nextPage) || nextPage === this.props.currentPage || this.props.loading) return

    if (this.selectAllCheckbox) this._clearChecked()
    if (window.history && typeof window.history.pushState === 'function' && href && href !== '#') {
      window.history.pushState({}, document.title, href)
    }

    this.loadTickets(nextPage)
  }

  render () {
    const loadingItems = []
    for (let i = 0; i < 51; i++) {
      const cells = []
      for (let k = 0; k < 10; k++) {
        cells.push(
          <TableCell key={k} className={'vam'}>
            <div className={'loadingTextAnimation'} />
          </TableCell>
        )
      }

      loadingItems.push(<TableRow key={Math.random()}>{cells}</TableRow>)
    }

    const selectAllCheckbox = (
      <div style={{ marginLeft: 17 }}>
        <input
          type='checkbox'
          id={'select_all'}
          style={{ display: 'none' }}
          className='svgcheckinput'
          onChange={e => this.onSelectAll(e)}
          ref={r => (this.selectAllCheckbox = r)}
        />
        <label htmlFor={'select_all'} className='svgcheck'>
          <svg width='16px' height='16px' viewBox='0 0 18 18'>
            <path d='M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z' />
            <polyline points='1 9 7 14 15 4' />
          </svg>
        </label>
      </div>
    )

    return (
      <div>
        <PageTitle
          title={'Tickets'}
          shadow={false}
          rightComponent={
            <div>
              <div className={'uk-float-right'}>
                <TitlePagination
                  limit={200}
                  total={this.props.totalCount}
                  type={this.props.view}
                  prevEnabled={this.props.prevEnabled}
                  nextEnabled={this.props.nextEnabled}
                  currentPage={this.props.currentPage}
                  prevPage={this.props.prevPage}
                  nextPage={this.props.nextPage}
                  filter={this.props.filter}
                  onPageChange={this.onPageChange}
                />
                <PageTitleButton
                  fontAwesomeIcon={'fa-refresh'}
                  onButtonClick={e => {
                    e.preventDefault()
                    this.loadTickets(this.props.currentPage)
                  }}
                />
                <PageTitleButton
                  fontAwesomeIcon={'fa-filter'}
                  onButtonClick={e => {
                    e.preventDefault()
                    this.props.showModal('FILTER_TICKET')
                  }}
                />
                <DropdownTrigger pos={'bottom-right'} offset={5} extraClass={'uk-float-left'}>
                  <PageTitleButton fontAwesomeIcon={'fa-tasks'} />
                  <Dropdown small={true} width={120}>
                    <DropdownItem text={'Create'} onClick={() => this.props.showModal('CREATE_TICKET')} />
                    <DropdownSeparator />
                    {this.props.ticketStatuses.map(s => (
                      <DropdownItem
                        key={s.get('_id')}
                        text={'Set ' + s.get('name')}
                        onClick={() => this.onSetStatus(s)}
                      />
                    ))}
                    {helpers.canUser('tickets:delete', true) && <DropdownSeparator />}
                    {helpers.canUser('tickets:delete', true) && (
                      <DropdownItem text={'Delete'} extraClass={'text-danger'} onClick={() => this.onDeleteClicked()} />
                    )}
                  </Dropdown>
                </DropdownTrigger>
                <div className={'uk-float-right'}>
                  <div
                    id={'ticket-search-box'}
                    className='search-box uk-float-left nb'
                    style={{ marginTop: 8, paddingLeft: 0 }}
                  >
                    <input
                      type='text'
                      id='tickets_Search'
                      placeholder={'Search'}
                      className={'ticket-top-search'}
                      value={this.searchTerm}
                      onChange={e => this.onSearchTermChanged(e)}
                      onFocus={e => this._onSearchFocus(e)}
                    />
                  </div>
                </div>
              </div>
              <SearchResults target={'#ticket-search-box'} ref={r => (this.searchContainer = r)} />
            </div>
          }
        />
        <PageContent padding={0} paddingBottom={0} extraClass={'uk-position-relative'}>
          {/*<SpinLoader active={this.props.loading} />*/}
          <Table
            tableRef={ref => (this.ticketsTable = ref)}
            style={{ margin: 0 }}
            extraClass={'pDataTable'}
            stickyHeader={true}
            striped={true}
            headers={[
              <TableHeader key={0} width={45} height={50} component={selectAllCheckbox} />,
              <TableHeader
                key={1}
                width={78}
                text={'Status'}
                sortable={true}
                sortDirection={this.state.sortBy === 'status' ? this.state.sortDirection : null}
                onSort={() => this.onSort('status')}
              />,
              <TableHeader
                key={2}
                width={65}
                text={'#'}
                sortable={true}
                sortDirection={this.state.sortBy === 'uid' ? this.state.sortDirection : null}
                onSort={() => this.onSort('uid')}
              />,
              <TableHeader
                key={3}
                width={'23%'}
                text={'Subject'}
                sortable={true}
                sortDirection={this.state.sortBy === 'subject' ? this.state.sortDirection : null}
                onSort={() => this.onSort('subject')}
              />,
              <TableHeader
                key={4}
                width={'13%'}
                text={'Type'}
                sortable={true}
                sortDirection={this.state.sortBy === 'type' ? this.state.sortDirection : null}
                onSort={() => this.onSort('type')}
              />,
              <TableHeader
                key={5}
                width={110}
                text={'Created'}
                sortable={true}
                sortDirection={this.state.sortBy === 'date' ? this.state.sortDirection : null}
                onSort={() => this.onSort('date')}
              />,
              <TableHeader
                key={6}
                width={125}
                text={'Requester'}
                sortable={true}
                sortDirection={this.state.sortBy === 'owner' ? this.state.sortDirection : null}
                onSort={() => this.onSort('owner')}
              />,
              <TableHeader
                key={7}
                width={175}
                text={'Customer'}
                sortable={true}
                sortDirection={this.state.sortBy === 'group' ? this.state.sortDirection : null}
                onSort={() => this.onSort('group')}
              />,
              <TableHeader
                key={8}
                text={'Assignee'}
                sortable={true}
                sortDirection={this.state.sortBy === 'assignee' ? this.state.sortDirection : null}
                onSort={() => this.onSort('assignee')}
              />,
              // <TableHeader key={8} width={110} text={'Due Date'} />,
              <TableHeader
                key={9}
                text={'Updated'}
                sortable={true}
                sortDirection={this.state.sortBy === 'updated' ? this.state.sortDirection : null}
                onSort={() => this.onSort('updated')}
              />
            ]}
          >
            {!this.props.loading && this.props.tickets.size < 1 && (
              <TableRow clickable={false}>
                <TableCell colSpan={10}>
                  <h5 style={{ margin: 10 }}>No Tickets Found</h5>
                </TableCell>
              </TableRow>
            )}
            {this.props.loading && loadingItems}
            {!this.props.loading &&
              this.props.tickets.map(ticket => {
                const status = this.props.ticketStatuses.find(s => s.get('_id') === ticket.get('status').get('_id'))

                const assignee = () => {
                  const a = ticket.get('assignee')
                  return !a ? '--' : a.get('fullname')
                }

                const updated = ticket.get('updated')
                  ? helpers.formatDate(ticket.get('updated'), helpers.getShortDateFormat()) +
                    ', ' +
                    helpers.formatDate(ticket.get('updated'), helpers.getTimeFormat())
                  : '--'

                const isOverdue = () => {
                  if (!this.props.common.viewdata.get('showOverdue') || [2, 3].indexOf(ticket.get('status')) !== -1)
                    return false
                  const overdueIn = ticket.getIn(['priority', 'overdueIn'])
                  const now = moment()
                  let updated = ticket.get('updated')
                  if (updated) updated = moment(updated)
                  else updated = moment(ticket.get('date'))

                  const timeout = updated.clone().add(overdueIn, 'm')
                  return now.isAfter(timeout)
                }

                return (
                  <TableRow
                    key={ticket.get('_id')}
                    className={`ticket-${status == null ? 'unknonwn' : status.get('name')} ${
                      isOverdue() ? 'overdue' : ''
                    }`}
                    clickable={true}
                    onClick={e => {
                      const td = e.target.closest('td')
                      const input = td.getElementsByTagName('input')
                      if (input.length > 0) return false
                      History.pushState(null, `Ticket-${ticket.get('uid')}`, `/tickets/${ticket.get('uid')}`)
                    }}
                  >
                    <TableCell
                      className={'ticket-priority nbb vam'}
                      style={{ borderColor: ticket.getIn(['priority', 'htmlColor']), padding: '18px 15px' }}
                    >
                      <input
                        type='checkbox'
                        id={`c_${ticket.get('_id')}`}
                        data-ticket={ticket.get('_id')}
                        style={{ display: 'none' }}
                        onChange={e => this.onTicketCheckChanged(e, ticket.get('_id'))}
                        className='svgcheckinput'
                      />
                      <label htmlFor={`c_${ticket.get('_id')}`} className='svgcheck'>
                        <svg width='16px' height='16px' viewBox='0 0 18 18'>
                          <path d='M1,9 L1,3.5 C1,2 2,1 3.5,1 L14.5,1 C16,1 17,2 17,3.5 L17,14.5 C17,16 16,17 14.5,17 L3.5,17 C2,17 1,16 1,14.5 L1,9 Z' />
                          <polyline points='1 9 7 14 15 4' />
                        </svg>
                      </label>
                    </TableCell>
                    <TableCell className={`ticket-status vam nbb uk-text-center`}>
                      <span
                        className={'uk-display-inline-block'}
                        style={{ backgroundColor: status == null ? '#000' : status.get('htmlColor') }}
                      >
                        {status == null ? 'U' : status.get('name')[0].toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className={'vam nbb'}>{ticket.get('uid')}</TableCell>
                    <TableCell className={'vam nbb'}>{ticket.get('subject')}</TableCell>
                    <TableCell className={'vam nbb'}>{ticket.getIn(['type', 'name'])}</TableCell>
                    <TableCell className={'vam nbb'}>
                      {helpers.formatDate(ticket.get('date'), helpers.getShortDateFormat())}
                    </TableCell>
                    <TableCell className={'vam nbb'}>{ticket.getIn(['owner', 'fullname'])}</TableCell>
                    <TableCell className={'vam nbb'}>{ticket.getIn(['group', 'name'])}</TableCell>
                    <TableCell className={'vam nbb'}>{assignee()}</TableCell>
                    <TableCell className={'vam nbb'}>{updated}</TableCell>
                  </TableRow>
                )
              })}
          </Table>
        </PageContent>
      </div>
    )
  }
}

TicketsContainer.propTypes = {
  socket: PropTypes.object.isRequired,
  view: PropTypes.string.isRequired,
  page: PropTypes.string.isRequired,
  currentPage: PropTypes.number.isRequired,
  prevPage: PropTypes.number.isRequired,
  nextPage: PropTypes.number.isRequired,
  prevEnabled: PropTypes.bool.isRequired,
  nextEnabled: PropTypes.bool.isRequired,
  tickets: PropTypes.object.isRequired,
  totalCount: PropTypes.string.isRequired,
  loading: PropTypes.bool.isRequired,
  fetchTickets: PropTypes.func.isRequired,
  deleteTicket: PropTypes.func.isRequired,
  ticketEvent: PropTypes.func.isRequired,
  unloadTickets: PropTypes.func.isRequired,
  ticketUpdated: PropTypes.func.isRequired,
  showModal: PropTypes.func.isRequired,
  fetchSearchResults: PropTypes.func.isRequired,
  common: PropTypes.object.isRequired,
  filter: PropTypes.object.isRequired,
  ticketStatuses: PropTypes.object.isRequired,
  fetchTicketStatus: PropTypes.func.isRequired
}

TicketsContainer.defaultProps = {
  view: 'active',
  page: 0,
  prevEnabled: true,
  nextEnabled: true
}

const mapStateToProps = (state, ownProps) => {
  const currentPage =
    state.ticketsState.currentPage === null || typeof state.ticketsState.currentPage === 'undefined'
      ? Number(ownProps.page || 0)
      : Number(state.ticketsState.currentPage)
  const prevPage = Number(state.ticketsState.prevPage)
  const nextPage = Number(state.ticketsState.nextPage)

  return {
    currentPage,
    tickets: state.ticketsState.tickets,
    totalCount: state.ticketsState.totalCount,
    prevPage,
    nextPage,
    prevEnabled: prevPage !== currentPage,
    nextEnabled: nextPage !== currentPage,
    loading: state.ticketsState.loading,
    common: state.common,
    socket: state.shared.socket,
    ticketStatuses: state.ticketsState.ticketStatuses,
    fetchTicketStatus: PropTypes.func.isRequired
  }
}

export default connect(mapStateToProps, {
  fetchTickets,
  deleteTicket,
  ticketEvent,
  unloadTickets,
  ticketUpdated,
  fetchSearchResults,
  showModal,
  fetchTicketStatus
})(TicketsContainer)
