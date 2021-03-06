import React from 'react'
import PropTypes from 'prop-types'

import styles from './LastSaved-Display.module.scss'

const LastSavedDisplay = ({ timeLastSaved }) =>
  <div className={styles.container}>
    <p>{`Last Saved: ${timeLastSaved}`}</p>
  </div>

LastSavedDisplay.propTypes = {
  timeLastSaved: PropTypes.string.isRequired
}
export default LastSavedDisplay
