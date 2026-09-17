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
 *  Updated:    4/3/19 1:22 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import React from 'react'
import PropTypes from 'prop-types'

class TableHeader extends React.Component {
  render () {
    const { width, height, padding, textAlign, text, component, sortable, sortDirection, onSort } = this.props
    const sortIndicator = sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : '↕'
    const onKeyDown = e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSort()
      }
    }

    return (
      <th
        onClick={sortable ? onSort : undefined}
        onKeyDown={sortable ? onKeyDown : undefined}
        tabIndex={sortable ? 0 : undefined}
        aria-sort={
          sortable
            ? sortDirection === 'asc'
              ? 'ascending'
              : sortDirection === 'desc'
              ? 'descending'
              : 'none'
            : undefined
        }
        style={{
          width,
          padding,
          height,
          verticalAlign: 'middle',
          fontSize: 12,
          textTransform: 'uppercase',
          textAlign,
          cursor: sortable ? 'pointer' : undefined,
          userSelect: sortable ? 'none' : undefined
        }}
      >
        {component}
        {text}
        {sortable && <span style={{ marginLeft: 4, fontSize: 9, opacity: 1 }}>{sortIndicator}</span>}
      </th>
    )
  }
}

TableHeader.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  padding: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  textAlign: PropTypes.string,
  text: PropTypes.string,
  component: PropTypes.oneOfType([PropTypes.element, PropTypes.func]),
  sortable: PropTypes.bool,
  sortDirection: PropTypes.oneOf(['asc', 'desc']),
  onSort: PropTypes.func
}

TableHeader.defaultProps = {
  textAlign: 'left',
  sortable: false
}

export default TableHeader
