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
 *  Updated:    2/10/19 3:06 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { observer } from 'mobx-react'
import { makeObservable, observable, when, toJS } from 'mobx'
import { head, orderBy } from 'lodash'
import axios from 'axios'
import Log from '../../logger'
import { createTicket, fetchTicketTypes } from 'actions/tickets'
import { fetchGroups } from 'actions/groups'
import { fetchAccountsCreateTicket } from 'actions/accounts'

import $ from 'jquery'
import helpers from 'lib/helpers'

import BaseModal from 'containers/Modals/BaseModal'
import Grid from 'components/Grid'
import GridItem from 'components/Grid/GridItem'
import SingleSelect from 'components/SingleSelect'
import MultiSelect from 'components/MultiSelect'
import SpinLoader from 'components/SpinLoader'
import Button from 'components/Button'
import EasyMDE from 'components/EasyMDE'

@observer
class CreateTicketModal extends React.Component {
  @observable priorities = []
  @observable ccAccounts = this.props.accounts || []
  @observable accountsByGroup = this.props.accounts || []
  @observable selectedPriority = ''
  @observable mappedGroups = []

  constructor (props) {
    super(props)
    makeObservable(this)

    this.state = {
      ticketTemplates: [],
      ticketDefaultTemplate: {},
      issueText: ''
    }
  }

  componentDidMount () {
    this.props.fetchTicketTypes()
    // this.props.getTagsWithPage({ limit: -1 })
    this.props.fetchGroups()
    this.props.fetchAccountsCreateTicket({ type: 'customers', limit: 1000 })
    helpers.UI.inputs()
    helpers.formvalidator()
    this.defaultTicketTypeWatcher = when(
      () => this.props.viewdata.get('defaultTicketType'),
      () => {
        this.priorities = orderBy(this.props.viewdata.toJS().defaultTicketType.priorities, ['migrationNum'])
        this.selectedPriority = head(this.priorities) ? head(this.priorities)._id : ''
      }
    )

    axios
      .get(`/api/v2/tickets/info/templates/`)
      .then(res => {
        const templates = res.data.ticketTemplates

        this.setState({
          ticketTemplates: templates,
          ticketDefaultTemplate: templates.find(
            item => item.name === this.props.viewdata.get('defaultTicketType').get('name')
          ),
          issueText: templates.find(item => item.name === this.props.viewdata.get('defaultTicketType').get('name')).text
        })
      })
      .catch(error => {
        this.priorityLoader.classList.add('hide')
        Log.error(error)
        helpers.UI.showSnackbar(`Error: ${error.response.data.error}`)
      })

    this.updateMappedGroups()

    this.updateAccountsByGroup()
  }

  componentDidUpdate (prevProps) {
    if (prevProps.groups !== this.props.groups) {
      this.updateMappedGroups()
    }

    if (prevProps.accounts !== this.props.accounts) {
      this.updateAccountsByGroup()
    }
  }

  componentWillUnmount () {
    if (this.defaultTicketTypeWatcher) this.defaultTicketTypeWatcher()
  }

  updateAccountsByGroup () {
    if (!this.props.accounts || this.props.accounts.size === 0) return

    this.accountsByGroup = this.props.accounts.filter(acc =>
      acc.get('groups').some(group => group.get('name') === 'Finance')
    )

    console.log('accountsByGroup ::: ', this.accountsByGroup)
  }

  updateMappedGroups () {
    this.mappedGroups = this.props.groups.map(grp => ({ text: grp.get('name'), value: grp.get('_id') })).toArray()

    const defaultGroup = this.mappedGroups.find(grp => grp.text === 'All')

    this.mappedGroups = this.mappedGroups.filter(grp =>
      this.mappedGroups.length > 1 ? grp.text !== 'All' : defaultGroup || grp
    )

    console.log(' mappedGroups ::::  ', this.mappedGroups)
  }

  onTicketTypeSelectChange (e) {
    this.priorityWrapper.classList.add('hide')
    this.priorityLoader.classList.remove('hide')
    axios
      .get(`/api/v1/tickets/type/${e.target.value}`)
      .then(res => {
        const type = res.data.type
        if (type && type.priorities) {
          this.priorities = orderBy(type.priorities, ['migrationNum'])
          this.selectedPriority = head(orderBy(type.priorities, ['migrationNum']))
            ? head(orderBy(type.priorities, ['migrationNum']))._id
            : ''

          this.setState({
            ticketDefaultTemplate: this.state.ticketTemplates.find(item => item.name === type.name),
            issueText: this.state.ticketTemplates.find(item => item.name === type.name).text
          })

          setTimeout(() => {
            this.priorityLoader.classList.add('hide')
            this.priorityWrapper.classList.remove('hide')
          }, 500)
        }
      })
      .catch(error => {
        this.priorityLoader.classList.add('hide')
        Log.error(error)
        helpers.UI.showSnackbar(`Error: ${error.response.data.error}`)
      })
  }

  onPriorityRadioChange (e) {
    this.selectedPriority = e.target.value
  }

  handleGroupSelectChange (e) {
    const groupName = e.target.selectedOptions[0].text

    const accountsByGroup = this.props.accounts
      ? this.props.accounts.filter(acc => acc.get('groups').some(group => group.get('name') === groupName))
      : []

    console.log('accountsByGroup ::: ', accountsByGroup)

    this.accountsByGroup = accountsByGroup || []
  }

  onFormSubmit (e) {
    e.preventDefault()
    const $form = $(e.target)

    const data = {}
    if (this.issueText.length < 1) return
    const allowAgentUserTickets =
      this.props.viewdata.get('ticketSettings').get('allowAgentUserTickets') &&
      (this.props.shared.sessionUser.role.isAdmin || this.props.shared.sessionUser.role.isAgent)

    const minIssueLength = this.props.viewdata.get('ticketSettings').get('minIssue')
    let $mdeError
    const $issueTextbox = $(this.issueMde.element)
    const $errorBorderWrap = $issueTextbox.parents('.error-border-wrap')
    if (this.issueText.length < minIssueLength) {
      $errorBorderWrap.css({ border: '1px solid #E74C3C' })
      const mdeError = $(
        `<div class="mde-error uk-float-left uk-text-left">Please enter a valid issue. Issue must contain at least ${minIssueLength} characters</div>`
      )
      $mdeError = $issueTextbox.siblings('.editor-statusbar').find('.mde-error')
      if ($mdeError.length < 1) $issueTextbox.siblings('.editor-statusbar').prepend(mdeError)

      return
    }

    $errorBorderWrap.css('border', 'none')
    $mdeError = $issueTextbox.parent().find('.mde-error')
    if ($mdeError.length > 0) $mdeError.remove()

    if (!$form.isValid(null, null, false)) return true

    if (allowAgentUserTickets) data.owner = this.ownerSelect.value

    data.subject = e.target.subject.value
    data.group = this.groupSelect.value
    data.type = this.typeSelect.value
    data.template = this.state.ticketDefaultTemplate._id
    data.priority = this.selectedPriority
    data.issue = this.issueMde.easymde.value()
    data.socketid = this.props.socket.io.engine.id

    data.subscribers = this.subscribers.getSelected()

    this.props.createTicket(data)
  }

  render () {
    const { shared, viewdata } = this.props
    const allowAgentUserTickets =
      viewdata.get('ticketSettings').get('allowAgentUserTickets') &&
      (shared.sessionUser.role.isAdmin || shared.sessionUser.role.isAgent)

    const mappedAccountsByGroup = this.accountsByGroup
      ? Array.from(
          new Map(
            this.accountsByGroup.map(group => [
              group.get('_id'),
              {
                text: group.get('fullname'),
                value: group.get('_id')
              }
            ])
          ).values()
        )
      : []

    const mappedAccountsCc = this.props.accounts
      ? Array.from(
          new Map(
            this.props.accounts.map(group => [
              group.get('_id'),
              {
                text: group.get('fullname'),
                value: group.get('_id')
              }
            ])
          ).values()
        )
      : []

    const mappedTicketTypes = this.props.ticketTypes.toArray().map(type => {
      return { text: type.get('name'), value: type.get('_id') }
    })

    console.log('mappedGroups ::: ', typeof this.mappedGroups)
    console.log('mappedGroups ::: ', toJS(this.mappedGroups))

    return (
      <BaseModal {...this.props} options={{ bgclose: false }}>
        <form className={'uk-form-stacked'} onSubmit={e => this.onFormSubmit(e)}>
          <div className='uk-margin-medium-bottom'>
            <label>Subject</label>
            <input
              type='text'
              name={'subject'}
              className={'md-input'}
              data-validation='length'
              data-validation-length={`min${viewdata.get('ticketSettings').get('minSubject')}`}
              data-validation-error-msg={`Please enter a valid Subject. Subject must contain at least ${viewdata
                .get('ticketSettings')
                .get('minSubject')} characters.`}
              autoComplete='off'
            />
          </div>
          <div className='uk-margin-medium-bottom'>
            <Grid>
              {allowAgentUserTickets && (
                <GridItem width={'2-4'}>
                  <label className={'uk-form-label'}>Owner</label>
                  <SingleSelect
                    showTextbox={true}
                    items={mappedAccountsByGroup}
                    defaultValue={this.props.shared.sessionUser._id}
                    width={'100%'}
                    ref={i => (this.ownerSelect = i)}
                  />
                </GridItem>
              )}
              <GridItem width={allowAgentUserTickets ? '2-4' : '1-1'}>
                <label className={'uk-form-label'}>Group</label>
                <SingleSelect
                  showTextbox={false}
                  items={toJS(this.mappedGroups)}
                  defaultValue={this.mappedGroups && this.mappedGroups[0] ? head(toJS(this.mappedGroups)).value : ''}
                  width={'100%'}
                  ref={i => (this.groupSelect = i)}
                  onSelectChange={e => this.handleGroupSelectChange(e)}
                />
              </GridItem>
            </Grid>
          </div>
          <div className='uk-margin-medium-bottom'>
            <label className={'uk-form-label'}>Cc</label>

            <MultiSelect items={mappedAccountsCc} ref={r => (this.subscribers = r)} />
          </div>
          <div className='uk-margin-medium-bottom'>
            <label className={'uk-form-label'}>Type</label>
            <SingleSelect
              showTextbox={false}
              items={mappedTicketTypes}
              width={'100%'}
              defaultValue={this.props.viewdata.get('defaultTicketType').get('_id')}
              onSelectChange={e => {
                this.onTicketTypeSelectChange(e)
              }}
              ref={i => (this.typeSelect = i)}
            />
          </div>
          <div className='uk-margin-medium-bottom'>
            <label className={'uk-form-label'}>Priority</label>
            <div
              ref={i => (this.priorityLoader = i)}
              style={{ height: '32px', width: '32px', position: 'relative' }}
              className={'hide'}
            >
              <SpinLoader
                style={{ background: 'transparent' }}
                spinnerStyle={{ width: '24px', height: '24px' }}
                active={true}
              />
            </div>
            <div ref={i => (this.priorityWrapper = i)} className={'uk-clearfix'}>
              {this.priorities.map(priority => {
                return (
                  <div key={priority._id} className={'uk-float-left'} style={{ width: '100%' }}>
                    <span className={'icheck-inline'} style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        id={'p___' + priority._id}
                        name={'priority'}
                        type='radio'
                        className={'with-gap'}
                        value={priority._id}
                        onChange={e => {
                          this.onPriorityRadioChange(e)
                        }}
                        checked={this.selectedPriority === priority._id}
                        data-md-icheck
                      />
                      <label htmlFor={'p___' + priority._id} className={'mb-10 inline-label'}>
                        <span className='uk-badge' style={{ backgroundColor: priority.htmlColor }}>
                          {priority.name}
                        </span>
                      </label>
                      <label htmlFor={'p___' + priority._id} className={'mb-10 inline-label'}>
                        <span>{priority.description}</span>
                      </label>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
          <div className='uk-margin-medium-bottom'>
            <span>Description</span>
            <div className='error-border-wrap uk-clearfix'>
              <EasyMDE
                ref={i => (this.issueMde = i)}
                onChange={val => (this.issueText = val)}
                allowImageUpload={true}
                inlineImageUploadUrl={'/tickets/uploadmdeimage'}
                inlineImageUploadHeaders={{ ticketid: 'uploads' }}
                defaultValue={this.state.issueText}
              />
            </div>
            <span style={{ marginTop: '6px', display: 'inline-block', fontSize: '11px' }} className={'uk-text-muted'}>
              Please try to be as specific as possible. Please include any details you think may be relevant, such as
              {/* eslint-disable-next-line react/no-unescaped-entities */}
              troubleshooting steps you've taken.
            </span>
          </div>
          <div className='uk-modal-footer uk-text-right'>
            <Button text={'Cancel'} flat={true} waves={true} extraClass={'uk-modal-close'} />
            <Button text={'Create'} style={'primary'} flat={true} type={'submit'} />
          </div>
        </form>
      </BaseModal>
    )
  }
}

CreateTicketModal.propTypes = {
  shared: PropTypes.object.isRequired,
  socket: PropTypes.object.isRequired,
  viewdata: PropTypes.object.isRequired,
  ticketTypes: PropTypes.object.isRequired,
  priorities: PropTypes.object.isRequired,
  ticketFormTypes: PropTypes.object.isRequired,
  accounts: PropTypes.object.isRequired,
  groups: PropTypes.object.isRequired,
  createTicket: PropTypes.func.isRequired,
  fetchTicketTypes: PropTypes.func.isRequired,
  fetchGroups: PropTypes.func.isRequired,
  fetchAccountsCreateTicket: PropTypes.func.isRequired,
  ticketDefaultTemplate: PropTypes.any
}

const mapStateToProps = state => ({
  shared: state.shared,
  socket: state.shared.socket,
  viewdata: state.common.viewdata,
  ticketTypes: state.ticketsState.types,
  ticketFormTypes: state.ticketsState.forms,
  priorities: state.ticketsState.priorities,
  groups: state.groupsState.groups,
  accounts: state.accountsState.accountsCreateTicket
})

export default connect(mapStateToProps, {
  createTicket,
  fetchTicketTypes,
  fetchGroups,
  fetchAccountsCreateTicket
})(CreateTicketModal)
