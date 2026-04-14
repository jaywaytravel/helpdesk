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
 *  Updated:    4/3/19 12:51 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import React from 'react'
import PropTypes from 'prop-types'

class TitlePagination extends React.Component {
  onPageClick (enabled, e) {
    if (enabled) return

    e.preventDefault()
  }

  static formatNumber (num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  static calcStartEnd (page, limit, total) {
    page = Number(page)
    limit = Number(limit)
    total = Number(total)

    if (total < 1) return { start: '0', end: '0' }

    const start = page * limit + 1
    const end = Math.min(page * limit + limit, total)

    return { start, end }
  }

  render () {
    const { limit, total, prevEnabled, nextEnabled, currentPage, prevPage, nextPage, type, filter } = this.props
    const link = page => {
      if (!type) return '#'
      if (type.toLowerCase() === 'filter') {
        return `${filter.raw}&page=${page}`
      } else {
        return `/tickets/${type}/page/${page}/`
      }
    }

    const startEnd = TitlePagination.calcStartEnd(currentPage, limit, total)

    return (
      <div className={'pagination uk-float-left uk-clearfix'} ref={r => (this.parent = r)}>
        <span className={'pagination-info'}>
          {TitlePagination.formatNumber(startEnd.start)} - {TitlePagination.formatNumber(startEnd.end)} of{' '}
          {TitlePagination.formatNumber(total)}
        </span>
        <ul className={'button-group'}>
          <li className='pagination'>
            <a
              href={prevEnabled ? link(prevPage) : '#'}
              title={'Previous Page'}
              className={'btn md-btn-wave-light no-ajaxy' + (!prevEnabled ? ' disabled' : '')}
              aria-disabled={!prevEnabled}
              onClick={e => this.onPageClick(prevEnabled, e)}
            >
              <i className='fa fa-large fa-chevron-left' />
            </a>
          </li>
          <li className='pagination'>
            <a
              href={nextEnabled ? link(nextPage) : '#'}
              title={'Next Page'}
              className={'btn md-btn-wave-light no-ajaxy' + (!nextEnabled ? ' disabled' : '')}
              aria-disabled={!nextEnabled}
              onClick={e => this.onPageClick(nextEnabled, e)}
            >
              <i className='fa fa-large fa-chevron-right' />
            </a>
          </li>
        </ul>
      </div>
    )
  }
}

TitlePagination.propTypes = {
  limit: PropTypes.number,
  total: PropTypes.string,
  type: PropTypes.string,
  filter: PropTypes.object,
  prevEnabled: PropTypes.bool.isRequired,
  nextEnabled: PropTypes.bool.isRequired,
  currentPage: PropTypes.string,
  prevPage: PropTypes.number,
  nextPage: PropTypes.number
}

TitlePagination.defaultProps = {
  limit: 50,
  prevPage: 0,
  nextPage: 1
}

export default TitlePagination
