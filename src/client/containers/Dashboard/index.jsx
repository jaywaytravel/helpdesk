import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { observer } from 'mobx-react'
import { observable } from 'mobx'

import {
  fetchDashboardData,
  fetchDashboardTopGroups,
  fetchDashboardTopTags,
  fetchDashboardOverdueTickets,
  

  fetchCountByType,
  fetchTotalTicketsThisMonth,
  fetchTotalTicketsLastMonth,
  fetchClosedOrRejectedLastMonth,
  fetchTicketsByStatusLastMonth,
  fetchAverageResolutionTime,
} from 'actions/dashboard'

import Grid from 'components/Grid'
import GridItem from 'components/Grid/GridItem'
import PageTitle from 'components/PageTitle'
import PageContent from 'components/PageContent'
import TruCard from 'components/TruCard'
import SingleSelect from 'components/SingleSelect'
import CountUp from 'components/CountUp'
import PeityBar from 'components/Peity/peity-bar'
import PeityPie from 'components/Peity/peity-pie'
import PeityLine from 'components/Peity/peity-line'
import MGraph from 'components/MGraph'
import D3Pie from 'components/D3/d3pie'

import moment from 'moment-timezone'
import helpers from 'lib/helpers'

@observer
class DashboardContainer extends React.Component {
  @observable timespan = 60

  constructor (props) {
    super(props)
  }

  componentDidMount () {
    helpers.UI.setupPeity()

    this.props.fetchDashboardData({ timespan: this.timespan })
    this.props.fetchDashboardTopGroups({ timespan: this.timespan })
    this.props.fetchDashboardTopTags({ timespan: this.timespan })
    this.props.fetchDashboardOverdueTickets()

    this.props.fetchCountByType()
    this.props.fetchTotalTicketsThisMonth()
    this.props.fetchTotalTicketsLastMonth()
    this.props.fetchClosedOrRejectedLastMonth()
    this.props.fetchTicketsByStatusLastMonth()
    this.props.fetchAverageResolutionTime()
    
  }

  onTimespanChange = e => {
    e.preventDefault()
    this.timespan = e.target.value
    this.props.fetchDashboardData({ timespan: e.target.value })
    this.props.fetchDashboardTopGroups({ timespan: e.target.value })
    this.props.fetchDashboardTopTags({ timespan: e.target.value })
  }

  render () {
    const formatString = helpers.getLongDateFormat() + ' ' + helpers.getTimeFormat()
    const tz = helpers.getTimezone()
    const lastUpdatedFormatted = this.props.dashboardState.lastUpdated
      ? moment(this.props.dashboardState.lastUpdated, 'MM/DD/YYYY hh:mm:ssa').tz(tz).format(formatString)
      : 'Cache Still Loading...'

    const closedPercent = this.props.dashboardState.closedCount
      ? Math.round((this.props.dashboardState.closedCount / this.props.dashboardState.ticketCount) * 100).toString()
      : '0'

    const monthList = [
      { text: 'January', value: '1' },
      { text: 'Fabruary', value: '2' },
      { text: 'March', value: '3' },
      { text: 'April', value: '4' },
      { text: 'May', value: '5' },
      { text: 'June', value: '6' },
      { text: 'July', value: '7' },
      { text: 'August', value: '8' },
      { text: 'September', value: '9' },
      { text: 'October', value: '10' },
      { text: 'November', value: '11' },
      { text: 'December', value: '12' }
    ]

    const yearList = [
      { text: '2025', value: '2025' },
      { text: '2024', value: '2024' },
    ]

    return (
      <div>
        <PageTitle
          title={'Dashboard'}
          rightComponent={
            <div>
              <div className={'uk-float-right'} style={{ minWidth: 250 }}>
                <div style={{ marginTop: 8 }}>
                  <SingleSelect
                    items={monthList}
                    defaultValue={'12'}
                    onSelectChange={e => this.onTimespanChange(e)}
                  />

                  <SingleSelect
                    items={yearList}
                    defaultValue={'2024'}
                    onSelectChange={e => this.onTimespanChange(e)}
                  />

                </div>
              </div>
              <div className={'uk-float-right uk-text-muted uk-text-small'} style={{ margin: '23px 25px 0 0' }}>
                <strong>Last Updated: </strong>
                <span>{lastUpdatedFormatted}</span>
              </div>
            </div>
          }
        />
        <PageContent>
          <Grid>
            <GridItem width={'1-3'}>
              <TruCard
                content={
                  <div>
                    <div className='right uk-margin-top uk-margin-small-right'>
                      <PeityBar values={'5,3,9,6,5,9,7'} />
                    </div>
                    <span className='uk-text-muted uk-text-small'>Total Tickets Created This Month</span>
                    <h2 className='uk-margin-remove'>
                      <CountUp startNumber={0} endNumber={this.props.dashboardState.totalTicketsThisMonth || 0} />
                    </h2>
                  </div>
                }
              />
            </GridItem>

            <GridItem width={'1-3'}>
              <TruCard
                content={
                  <div>
                    <div className='right uk-margin-top uk-margin-small-right'>
                      <PeityBar values={'5,3,9,6,5,9,7'} />
                    </div>
                    <span className='uk-text-muted uk-text-small'>Total Tickets Created Last Month</span>
                    <h2 className='uk-margin-remove'>
                    <CountUp startNumber={0} endNumber={this.props.dashboardState.totalTicketsLastMonth || 0} />
                    </h2>
                  </div>
                }
              />
            </GridItem>
            <GridItem width={'1-3'}>
              <TruCard
                content={
                  <div>
                    <div className='right uk-margin-top uk-margin-small-right'>
                      <PeityLine values={'5,3,9,6,5,9,7,3,5,2'} />
                    </div>
                    <span className='uk-text-muted uk-text-small'>Avg Resolution Time</span>

                    <h2 className='uk-margin-remove'>
                      <CountUp endNumber={this.props.dashboardState.avgResolutionTime  || 0} extraText={'hours'} />
                    </h2>
                  </div>
                }
              />
            </GridItem>
            <GridItem width={'1-1'} extraClass={'uk-margin-medium-top'}>
              <TruCard
                header={
                  <div className='uk-text-left'>
                    <h6 style={{ padding: 15, margin: 0, fontSize: '14px' }}>Ticket Breakdown</h6>
                  </div>
                }
                fullSize={true}
                hover={false}
                extraContentClass={'nopadding'}
                content={
                  <div className='mGraph mGraph-panel' style={{ minHeight: 200, position: 'relative' }}>
                    <MGraph
                      height={250}
                      x_accessor={'date'}
                      y_accessor={'value'}
                      data={this.props.dashboardState.ticketBreakdownData.toJS() || []}
                    />
                  </div>
                }
              />
            </GridItem>
            <GridItem width={'1-3'} extraClass={'uk-margin-medium-top'}>
              <TruCard
                loaderActive={this.props.dashboardState.loadingCountByType}
                animateLoader={true}
                style={{ minHeight: 256 }}
                header={
                  <div className='uk-text-left'>
                    <h6 style={{ padding: 15, margin: 0, fontSize: '14px' }}>Ticket Distribution by Type</h6>
                  </div>
                }
                content={
                  <div>
                    <D3Pie data={this.props.dashboardState.countByType.toJS()} />
                  </div>
                }
              />
            </GridItem>
            <GridItem width={'1-3'} extraClass={'uk-margin-medium-top'}>
              <TruCard
                loaderActive={this.props.dashboardState.loadingClosedOrRejectedLastMonth}
                animateLoader={true}
                style={{ minHeight: 256 }}
                header={
                  <div className='uk-text-left'>
                    <h6 style={{ padding: 15, margin: 0, fontSize: '14px' }}>Closed and Rejected Tickets Last Month</h6>
                  </div>
                }
                content={
                  <div>
                    <D3Pie data={this.props.dashboardState.closedOrRejectedLastMonth.toJS()} />
                  </div>
                }
              />
            </GridItem>
            <GridItem width={'1-3'} extraClass={'uk-margin-medium-top'}>
              <TruCard
                loaderActive={this.props.dashboardState.loadingTicketsByStatusLastMonth}
                animateLoader={true}
                style={{ minHeight: 256 }}
                header={
                  <div className='uk-text-left'>
                    <h6 style={{ padding: 15, margin: 0, fontSize: '14px' }}>Tickets Status Breakdown for Last Month</h6>
                  </div>
                }
                content={
                  <div>
                    <D3Pie data={this.props.dashboardState.ticketsByStatusLastMonth.toJS()} />
                  </div>
                }
              />
            </GridItem>
          </Grid>
        </PageContent>
      </div>
    )
  }
}

DashboardContainer.propTypes = {
  fetchDashboardData: PropTypes.func.isRequired,
  fetchDashboardTopGroups: PropTypes.func.isRequired,
  fetchDashboardTopTags: PropTypes.func.isRequired,
  fetchDashboardOverdueTickets: PropTypes.func.isRequired,
  fetchCountByType: PropTypes.func.isRequired,
  fetchTotalTicketsThisMonth: PropTypes.func.isRequired,
  fetchTotalTicketsLastMonth: PropTypes.func.isRequired,
  fetchClosedOrRejectedLastMonth: PropTypes.func.isRequired,
  fetchTicketsByStatusLastMonth: PropTypes.func.isRequired,
  fetchTicketsByStatusLastMonth: PropTypes.func.isRequired,
  dashboardState: PropTypes.object.isRequired
}

const mapStateToProps = state => ({
  dashboardState: state.dashboardState
})

export default connect(mapStateToProps, {
  fetchDashboardData,
  fetchDashboardTopGroups,
  fetchDashboardTopTags,
  fetchDashboardOverdueTickets,

  fetchCountByType,
  fetchTotalTicketsThisMonth,
  fetchTotalTicketsLastMonth,
  fetchClosedOrRejectedLastMonth,
  fetchTicketsByStatusLastMonth,
  fetchAverageResolutionTime
})(DashboardContainer)
