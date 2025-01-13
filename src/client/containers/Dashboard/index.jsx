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
  fetchTotalTicketsCount,
  fetchTicketsByPriority,
  fetchTicketsByStatus,
  fetchAverageResolutionTime
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
  @observable timespan = {
    month: moment().format('M'),
    year: moment().format('YYYY')
  }

  constructor (props) {
    super(props)
  }

  componentDidMount () {
    helpers.UI.setupPeity()

    this.props.fetchDashboardData({ timespan: this.timespan })
    this.props.fetchDashboardTopGroups({ timespan: this.timespan })
    this.props.fetchDashboardTopTags({ timespan: this.timespan })
    this.props.fetchDashboardOverdueTickets()

    this.props.fetchCountByType({ timespan: this.timespan })
    this.props.fetchTotalTicketsCount({ timespan: this.timespan })
    // this.props.fetchTotalTicketsLastMonth()
    this.props.fetchTicketsByStatus({ timespan: this.timespan })

    this.props.fetchTicketsByPriority({ timespan: this.timespan })

    this.props.fetchAverageResolutionTime({ timespan: this.timespan })
  }

  onYearChange = e => {
    e.preventDefault()

    this.timespan.year = e.target.value

    this.props.fetchCountByType({
      timespan: {
        month: this.timespan.month,
        year: e.target.value
      }
    })

    this.props.fetchAverageResolutionTime({
      timespan: {
        month: this.timespan.month,
        year: e.target.value
      }
    })

    this.props.fetchTicketsByPriority({
      timespan: {
        month: this.timespan.month,
        year: e.target.value
      }
    })

    this.props.fetchTicketsByStatus({
      timespan: {
        month: this.timespan.month,
        year: e.target.value
      }
    })

    this.props.fetchTotalTicketsCount({
      timespan: {
        month: this.timespan.month,
        year: e.target.value
      }
    })

    this.props.fetchDashboardData({
      timespan: {
        month: this.timespan.month,
        year: e.target.value
      }
    })
    // this.props.fetchDashboardTopGroups({
    //   timespan: {
    //     ...this.timespan,
    //     year: e.target.value
    //   }
    // })
    // this.props.fetchDashboardTopTags({
    //   timespan: {
    //     month: this.timespan.month,
    //     year: e.target.value
    //   }
    // })
  }

  onMonthChange = e => {
    e.preventDefault()
    this.timespan.month = e.target.value

    this.props.fetchCountByType({
      timespan: {
        year: this.timespan.year,
        month: e.target.value
      }
    })

    this.props.fetchAverageResolutionTime({
      timespan: {
        year: this.timespan.year,
        month: e.target.value
      }
    })

    this.props.fetchTicketsByPriority({
      timespan: {
        year: this.timespan.year,
        month: e.target.value
      }
    })

    this.props.fetchTicketsByStatus({
      timespan: {
        year: this.timespan.year,
        month: e.target.value
      }
    })

    this.props.fetchTotalTicketsCount({
      timespan: {
        year: this.timespan.year,
        month: e.target.value
      }
    })

    this.props.fetchDashboardData({
      timespan: {
        ...this.timespan,
        month: e.target.value
      }
    })
    // this.props.fetchDashboardTopGroups({
    //   timespan: {
    //     ...this.timespan,
    //     month: e.target.value
    //   }
    // })
    // this.props.fetchDashboardTopTags({
    //   timespan: {
    //     ...this.timespan,
    //     month: e.target.value
    //   }
    // })
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
      { text: '2024', value: '2024' }
    ]

    return (
      <div>
        <PageTitle
          title={'Dashboard'}
          rightComponent={
            <div>
              <div className={'uk-float-right'} style={{ minWidth: 250 }}>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: '150px' }}>
                    <SingleSelect
                      items={monthList}
                      defaultValue={this.timespan.month}
                      onSelectChange={e => this.onMonthChange(e)}
                    />
                  </div>

                  <div style={{ width: '150px' }}>
                    <SingleSelect
                      items={yearList}
                      defaultValue={this.timespan.year}
                      onSelectChange={e => this.onYearChange(e)}
                    />
                  </div>
                </div>
              </div>
            </div>
          }
        />
        <PageContent>
          <Grid>
            <GridItem width={'1-2'}>
              <TruCard
                content={
                  <div>
                    <div className='right uk-margin-top uk-margin-small-right'>
                      <PeityBar values={'5,3,9,6,5,9,7'} />
                    </div>
                    <span className='uk-text-muted uk-text-small'>Total Tickets Count</span>
                    <h2 className='uk-margin-remove'>
                      <CountUp startNumber={0} endNumber={this.props.dashboardState.totalTicketsCount || 0} />
                    </h2>
                  </div>
                }
              />
            </GridItem>

            <GridItem width={'1-2'}>
              <TruCard
                content={
                  <div>
                    <div className='right uk-margin-top uk-margin-small-right'>
                      <PeityLine values={'5,3,9,6,5,9,7,3,5,2'} />
                    </div>
                    <span className='uk-text-muted uk-text-small'>Avg Resolution Time</span>

                    <h2 className='uk-margin-remove'>
                      <CountUp
                        endNumber={this.props.dashboardState.avgResolutionTimeInHours || 0}
                        extraText={'hours'}
                      />
                    </h2>
                  </div>
                }
              />
            </GridItem>
            {/* <GridItem width={'1-1'} extraClass={'uk-margin-medium-top'}>
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
            </GridItem> */}
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
                loaderActive={this.props.dashboardState.loadingTicketsByPriority}
                animateLoader={true}
                style={{ minHeight: 256 }}
                header={
                  <div className='uk-text-left'>
                    <h6 style={{ padding: 15, margin: 0, fontSize: '14px' }}>Tickets Distribution by Priority</h6>
                  </div>
                }
                content={
                  <div>
                    <D3Pie data={this.props.dashboardState.ticketsByPriority.toJS()} />
                  </div>
                }
              />
            </GridItem>
            <GridItem width={'1-3'} extraClass={'uk-margin-medium-top'}>
              <TruCard
                loaderActive={this.props.dashboardState.loadingTicketsByStatus}
                animateLoader={true}
                style={{ minHeight: 256 }}
                header={
                  <div className='uk-text-left'>
                    <h6 style={{ padding: 15, margin: 0, fontSize: '14px' }}>Tickets Distribution by Status</h6>
                  </div>
                }
                content={
                  <div>
                    <D3Pie data={this.props.dashboardState.ticketsByStatus.toJS()} />
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
  fetchTotalTicketsCount: PropTypes.func.isRequired,
  // fetchTotalTicketsLastMonth: PropTypes.func.isRequired,
  fetchTicketsByStatus: PropTypes.func.isRequired,
  fetchTicketsByPriority: PropTypes.func.isRequired,
  dashboardState: PropTypes.object.isRequired,
  fetchAverageResolutionTime: PropTypes.func.isRequired
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
  fetchTotalTicketsCount,
  // fetchTotalTicketsLastMonth,
  fetchTicketsByPriority,
  fetchTicketsByStatus,
  fetchAverageResolutionTime
})(DashboardContainer)
