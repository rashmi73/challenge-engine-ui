import _ from 'lodash'
import * as queryString from 'query-string'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Helmet } from 'react-helmet'
import cn from 'classnames'
import moment from 'moment'
import { pick } from 'lodash/fp'
import Modal from '../Modal'
import { VALIDATION_VALUE_TYPE } from '../../config/constants'
import { PrimaryButton, OutlineButton } from '../Buttons'
import TrackField from './Track-Field'
import TypeField from './Type-Field'
import ChallengeNameField from './ChallengeName-Field'
import CopilotField from './Copilot-Field'
import ReviewTypeField from './ReviewType-Field'
import TermsField from './Terms-Field'
import GroupsField from './Groups-Field'
import CopilotFeeField from './CopilotFee-Field'
import ChallengeTotalField from './ChallengeTotal-Field'
import ChallengePrizesField from './ChallengePrizes-Field'
import AttachmentField from './Attachment-Field'
import TextEditorField from './TextEditor-Field'
import Loader from '../Loader'
import ChallengeScheduleField from './ChallengeSchedule-Field'
import { convertDollarToInteger, validateValue } from '../../util/input-check'
import dropdowns from './mock-data/dropdowns'
import styles from './ChallengeEditor.module.scss'
import { withRouter } from 'react-router-dom'
import { createChallenge, updateChallenge, createResource, deleteResource } from '../../services/challenges'

const theme = {
  container: styles.modalContainer
}

const getTitle = (isNew) => {
  if (isNew) {
    return 'Create New Challenge'
  }

  return 'Edit Challenge'
}

class ChallengeEditor extends Component {
  constructor (props) {
    super(props)
    this.state = {
      isLaunch: false,
      isConfirm: false,
      isClose: false,
      isOpenAdvanceSettings: false,
      isLoading: false,
      isSaving: false,
      hasValidationErrors: false,
      challenge: {
        ...dropdowns['newChallenge'],
        startDate: moment().add(1, 'hour').format(),
        phases: []
      },
      draftChallenge: { data: { id: null } }
    }
    this.onUpdateInput = this.onUpdateInput.bind(this)
    this.onUpdateSelect = this.onUpdateSelect.bind(this)
    this.onUpdateOthers = this.onUpdateOthers.bind(this)
    this.onUpdateCheckbox = this.onUpdateCheckbox.bind(this)
    this.toggleAdvanceSettings = this.toggleAdvanceSettings.bind(this)
    this.removeAttachment = this.removeAttachment.bind(this)
    this.removePhase = this.removePhase.bind(this)
    this.resetPhase = this.resetPhase.bind(this)
    this.toggleLaunch = this.toggleLaunch.bind(this)
    this.onUpdateMultiSelect = this.onUpdateMultiSelect.bind(this)
    this.onUpdatePhase = this.onUpdatePhase.bind(this)
    this.resetChallengeData = this.resetChallengeData.bind(this)
    this.onUpdateDescription = this.onUpdateDescription.bind(this)
    this.onSubmitChallenge = this.onSubmitChallenge.bind(this)
    this.resetModal = this.resetModal.bind(this)
    this.checkToCreateDraftChallenge = this.checkToCreateDraftChallenge.bind(this)
    this.getCurrentChallengeId = this.getCurrentChallengeId.bind(this)
    this.addQueryToUrl = this.addQueryToUrl.bind(this)
    this.isValidChallenge = this.isValidChallenge.bind(this)
    this.autoUpdateChallengeThrottled = _.throttle(this.autoUpdateChallenge.bind(this), 1000)
  }

  componentDidMount () {
    this.resetChallengeData(this.props.isNew, this.props.challengeId, this.props.challengeDetails, this.props.metadata, this.props.attachments)
  }

  componentWillReceiveProps (nextProps) {
    const { isNew: newValue, challengeId, challengeDetails, metadata, attachments } = nextProps
    this.resetChallengeData(newValue, challengeId, challengeDetails, metadata, attachments)
  }

  async resetChallengeData (isNew, challengeId, challengeDetails, metadata, attachments) {
    if (!isNew) {
      try {
        const copilotResource = this.getResourceFromProps('Copilot')
        const copilotFromResources = copilotResource ? copilotResource.memberHandle : ''
        const reviewerResource = this.getResourceFromProps('Reviewer')
        const reviewerFromResources = reviewerResource ? reviewerResource.memberHandle : ''
        this.setState({ isConfirm: false, isLaunch: false })
        const challengeData = this.updateAttachmentlist(challengeDetails, attachments)
        let copilot, reviewer
        const challenge = this.state.challenge
        if (challenge) {
          copilot = challenge.copilot
          reviewer = challenge.reviewer
        }
        challengeData.copilot = copilot || copilotFromResources
        challengeData.reviewer = reviewer || reviewerFromResources
        this.setState({ challenge: { ...dropdowns['newChallenge'], ...challengeData }, isLoading: false })
      } catch (e) {
        this.setState({ isLoading: true })
      }
    }
  }

  resetModal () {
    this.setState({ isLoading: true, isConfirm: false, isLaunch: false })
  }

  onUpdateDescription (description, fieldName) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge, [fieldName]: description }
    this.setState({ challenge: newChallenge }, () => {
      this.autoUpdateChallengeThrottled()
    })
  }

  /**
   * Update Input value of challenge
   * @param e The input event
   * @param isSub The value from sub field of challenge field
   * @param field The challenge field
   * @param index The index of array
   * @param valueType The value type. eg. number, integer, string
   */
  onUpdateInput (e, isSub = false, field = null, index = -1, valueType = null) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    if (!isSub) {
      switch (e.target.name) {
        case 'reviewCost':
        case 'copilotFee':
          newChallenge[e.target.name] = validateValue(e.target.value, VALIDATION_VALUE_TYPE.INTEGER, '$')
          break
        default:
          newChallenge[e.target.name] = e.target.value
          break
      }
    } else {
      switch (field) {
        case 'checkpointPrizes':
          switch (e.target.name) {
            case 'checkNumber':
              newChallenge[field][e.target.name] = validateValue(e.target.value, VALIDATION_VALUE_TYPE.INTEGER)
              break
            case 'checkAmount':
              newChallenge[field][e.target.name] = validateValue(e.target.value, VALIDATION_VALUE_TYPE.INTEGER, '$')
          }
          break
        case 'prizes':
          switch (valueType) {
            case VALIDATION_VALUE_TYPE.STRING:
              newChallenge[field][index]['amount'] = e.target.value.trim()
              newChallenge['focusIndex'] = index
              break
            case VALIDATION_VALUE_TYPE.INTEGER:
              newChallenge['focusIndex'] = index
              newChallenge[field][index]['amount'] = validateValue(e.target.value, VALIDATION_VALUE_TYPE.INTEGER)
          }
          break
        default:
          newChallenge[field][e.target.name] = e.target.value
          break
      }
    }

    // calculate total cost of challenge
    this.setState({ challenge: newChallenge }, () => {
      this.autoUpdateChallengeThrottled()
    })
  }

  /**
   * Update Single Select
   * @param option The select option
   * @param isSub The option from sub field
   * @param field The challenge field
   * @param index The index of array
   */
  onUpdateSelect (option, isSub = false, field = '', index = -1) {
    if (option) {
      const { challenge: oldChallenge } = this.state
      const newChallenge = { ...oldChallenge }
      if (!isSub) {
        newChallenge[field] = option
      } else {
        if (index < 0) {
          newChallenge[field][option.key] = option.name
        } else {
          newChallenge[field][index][option.key] = option.name
        }
      }

      this.setState({ challenge: newChallenge }, () => {
        this.autoUpdateChallengeThrottled()
      })
    }
  }

  /**
   * Update other fields of challenge
   * @param data
   */
  onUpdateOthers (data) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    let { value, field } = data
    if (field === 'copilot' && value === newChallenge[field]) {
      value = null
    }
    if (field === 'phases') {
      value = value && value.map(element => _.set(_.set({}, 'duration', element.duration), 'phaseId', element.id))
    }
    newChallenge[field] = value
    this.setState({ challenge: newChallenge }, () => {
      this.checkToCreateDraftChallenge()
      this.autoUpdateChallengeThrottled()
    })
  }

  /**
   * Update Checkbox
   * @param id The checkbox id
   * @param checked The check status
   * @param field The challenge field
   * @param index The index of array
   * @param isSingleCheck Allow check only one
   */
  onUpdateCheckbox (id, checked, field = '', index = -1, isSingleCheck = false) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    if (field === 'reviewType' && !checked) {
      return
    }
    if (index < 0) {
      if (!_.isEmpty(field)) {
        if (isSingleCheck) {
          _.set(newChallenge, `${field}.${id}`, checked)
        } else {
          if (field !== 'terms') {
            for (let key in newChallenge[field]) {
              if (typeof key === 'boolean') {
                _.set(newChallenge, `${field}.${key}`, false)
              } else {
                _.set(newChallenge, `${field}.${key}`, '')
              }
            }
          }
          _.set(newChallenge, `${field}.${id}`, checked)
        }
      }
      newChallenge[id] = checked
    } else {
      _.set(newChallenge, `${field}.${index}.check`, checked)
    }
    this.setState({ challenge: newChallenge }, () => {
      this.autoUpdateChallengeThrottled()
    })
  }

  toggleAdvanceSettings () {
    const { isOpenAdvanceSettings } = this.state
    this.setState({ isOpenAdvanceSettings: !isOpenAdvanceSettings })
  }

  removeAttachment (file) {
    const { challenge } = this.state
    const newChallenge = { ...challenge }
    const { attachments: oldAttachments } = challenge
    const newAttachments = _.remove(oldAttachments, att => att.fileName !== file)
    newChallenge.attachments = _.clone(newAttachments)
    this.setState({ challenge: newChallenge }, () => {
      this.autoUpdateChallengeThrottled()
    })
  }

  /**
   * Remove Phase from challenge Phases list
   * @param index
   */
  removePhase (index) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    const newPhaseList = _.cloneDeep(oldChallenge.phases)
    newPhaseList.splice(index, 1)
    newChallenge.phases = _.clone(newPhaseList)
    this.setState({ challenge: newChallenge }, () => {
      this.autoUpdateChallengeThrottled()
    })
  }
  /**
   * Reset  challenge Phases
   */
  resetPhase (timeline) {
    const timelinePhaseIds = timeline.phases.map(timelinePhase => timelinePhase.phaseId || timelinePhase)
    const validPhases = this.props.metadata.challengePhases.filter(challengePhase => {
      return timelinePhaseIds.includes(challengePhase.id)
    })
    this.onUpdateOthers({
      field: 'phases',
      value: validPhases
    })
  }

  toggleLaunch () {
    if (this.validateChallenge()) {
      this.setState({ isLaunch: true })
    }
  }

  isValidChallenge () {
    if (Object.values(pick(['track', 'typeId', 'name', 'description', 'tags', 'prizeSets'], this.state.challenge)).filter(v => !v.length).length) {
      return false
    }
    return true
  }

  validateChallenge () {
    if (this.isValidChallenge()) {
      this.setState({ hasValidationErrors: false })
      return true
    }
    this.setState(prevState => ({
      ...prevState,
      challenge: {
        ...prevState.challenge,
        submitTriggered: true
      }
    }))
    this.setState({ hasValidationErrors: true })
    return false
  }

  /**
   * Update Multi Select
   * @param options The option of select
   * @param field The challenge field
   */
  onUpdateMultiSelect (options, field) {
    const { challenge } = this.state
    let newChallenge = { ...challenge }
    newChallenge[field] = options ? options.split(',') : []
    if (field === 'termsIds') {
      // backwards compatibily with v4 requires converting 'terms' field to 'termsIds'
      delete newChallenge.terms
    }
    this.setState({ challenge: newChallenge }, () => {
      this.autoUpdateChallengeThrottled()
    })
  }

  onUpdatePhase (newValue, property, index) {
    if (property === 'duration' && newValue < 0) newValue = 0
    let newChallenge = _.cloneDeep(this.state.challenge)
    newChallenge.phases[index][property] = newValue
    this.setState({ challenge: newChallenge }, () => {
      this.autoUpdateChallengeThrottled()
    })
  }

  onUploadFile (files) {
    const { challenge: oldChallenge } = this.state
    const newChallenge = { ...oldChallenge }
    _.forEach(files, (file) => {
      newChallenge.attachments.push({
        fileName: file.name,
        size: file.size
      })
    })
    this.setState({ challenge: newChallenge }, () => {
      this.autoUpdateChallengeThrottled()
    })
  }

  collectChallengeData (status) {
    const { attachments } = this.props
    const challenge = pick([
      'phases',
      'typeId',
      'track',
      'name',
      'description',
      'privateDescription',
      'reviewType',
      'tags',
      'groups',
      'prizeSets',
      'startDate',
      'termsIds'], this.state.challenge)
    challenge.timelineTemplateId = this.props.metadata.timelineTemplates[0].id
    challenge.projectId = this.props.projectId
    challenge.prizeSets = challenge.prizeSets.map(p => {
      const prizes = p.prizes.map(s => ({ ...s, value: convertDollarToInteger(s.value, '$') }))
      return { ...p, prizes }
    })
    challenge.status = status
    if (this.state.challenge.id) {
      challenge.attachmentIds = _.map(attachments, item => item.id)
    }
    if (challenge.termsIds && challenge.termsIds.length === 0) delete challenge.termsIds
    delete challenge.attachments
    return challenge
  }

  /**
    * Append draft challenge id to url
    * @param {Object} query query params object
  */
  addQueryToUrl (query) {
    const { history } = this.props
    const location = Object.assign({}, history.location)
    history.push(`${location.pathname}?${queryString.stringify(query)}`)
  };

  async checkToCreateDraftChallenge () {
    if (this.state.isSaving || !this.props.isNew || this.getCurrentChallengeId()) return
    const challenge = this.collectChallengeData('Draft')
    // can't create challenge without empty project
    // I add fake data to make sure create challenge success
    // but we only need challenge id
    if (!challenge.phases || !challenge.phases.length) return
    this.setState({ isSaving: true })
    if (!challenge.typeId) {
      challenge.typeId = this.props.metadata.challengeTypes[0].id
    }
    if (!challenge.track) {
      challenge.track = 'DEVELOP'
    }
    if (!challenge.name) {
      challenge.name = 'Draft'
    }
    if (!challenge.description) {
      challenge.description = 'Draft'
    }
    if (!challenge.prizeSets || !challenge.prizeSets.length) {
      challenge.prizeSets = [
        {
          type: 'Challenge prizes',
          prizes: [ {
            type: 'money', value: '1' } ]
        }
      ]
    }
    if (!challenge.tags || !challenge.tags.length) {
      challenge.tags = ['Heroku']
    }

    try {
      const draftChallenge = await createChallenge(challenge)
      this.addQueryToUrl({
        challengeId: draftChallenge.data.id
      })
      this.setState({ isSaving: false, draftChallenge })
    } catch (e) {
      this.setState({ isSaving: false })
    }
  }

  async autoUpdateChallenge () {
    if (this.state.isSaving || !this.getCurrentChallengeId() || !this.isValidChallenge()) return
    const challenge = this.collectChallengeData(this.getCurrentChallengeStatus())
    await this.updateAllChallengeInfo(challenge)
  }

  getCurrentChallengeStatus () {
    const { challenge } = this.state
    if (challenge && challenge.status) {
      return challenge.status
    }
    return 'Draft'
  }

  getCurrentChallengeId () {
    let { challengeId } = this.props
    if (!challengeId) {
      challengeId = this.state.draftChallenge.data.id
    }
    if (!challengeId) {
      const { history } = this.props
      const queryParams = queryString.parse(history.location.search)
      challengeId = queryParams.challengeId
    }
    return challengeId
  }

  async onSubmitChallenge (status = 'Active') {
    if (this.state.isSaving) return
    const challenge = this.collectChallengeData(status)
    try {
      this.setState({ isSaving: true })
      const response = await this.updateAllChallengeInfo(challenge)
      this.setState({ isLaunch: true, isConfirm: response.data.id, challenge: { ...this.state.challenge, ...challenge }, isSaving: false })
    } catch (e) {
      this.setState({ isSaving: false })
    }
  }

  async updateAllChallengeInfo (challenge) {
    const challengeId = this.getCurrentChallengeId()
    const response = await updateChallenge(challenge, challengeId)
    const { copilot, reviewer } = this.state.challenge
    if (copilot) await this.updateResource(response.data.id, 'Copilot', copilot)
    if (reviewer) await this.updateResource(response.data.id, 'Reviewer', reviewer)
    return response
  }

  getResourceRoleByName (name) {
    const { resourceRoles } = this.props.metadata
    return resourceRoles ? resourceRoles.find(role => role.name === name) : null
  }

  async updateResource (challengeId, name, value) {
    let needToCreateResource = this.props.isNew
    const newResource = {
      challengeId,
      memberHandle: value,
      roleId: this.getResourceRoleByName(name).id
    }
    const currentResource = this.getResourceFromProps(name)
    if (currentResource && value !== currentResource.memberHandle) {
      needToCreateResource = true
      const resource = _.pick(currentResource, ['challengeId', 'memberHandle', 'roleId'])
      await deleteResource(resource)
    }
    if (needToCreateResource) await createResource(newResource)
  }

  updateAttachmentlist (challenge, attachments) {
    const newChallenge = _.cloneDeep(challenge)
    if (attachments.length > 0) {
      if (!_.has(challenge, 'attachments')) {
        newChallenge.attachments = []
      }

      newChallenge.attachments = _.cloneDeep(attachments)
    } else {
      newChallenge.attachments = []
    }

    return newChallenge
  }

  getResourceFromProps (name) {
    const { challengeResources } = this.props
    const role = this.getResourceRoleByName(name)
    return challengeResources && role && challengeResources.find(resource => resource.roleId === role.id)
  }

  render () {
    const { isLaunch, isConfirm, challenge, isOpenAdvanceSettings } = this.state
    const {
      isNew,
      isDraft,
      isLoading,
      metadata,
      uploadAttachment,
      token,
      removeAttachment,
      failedToLoad } = this.props
    if (_.isEmpty(challenge)) {
      return <div>Error loading challenge</div>
    }
    if (isLoading || _.isEmpty(metadata.challengePhases)) return <Loader />
    if (failedToLoad) {
      return (
        <div className={styles.wrapper}>
          <div className={styles.title}>There was an error loading the challenge</div>
          <br />
          <div className={styles.container}>
            <div className={styles.formContainer}>
              <div className={styles.group}>
                <div className={styles.row}>
                  <div className={styles.error}>
                    Please try again later and if the issue persists contact us at&nbsp;
                    <a href='mailto:support@topcoder.com'>support@topcoder.com</a>
                    &nbsp;to resolve the issue as soon as possible.
                  </div>
                  <br />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    let { type } = challenge
    if (!type) {
      const { typeId } = challenge
      if (typeId && metadata.challengeTypes) {
        const selectedType = _.find(metadata.challengeTypes, { id: typeId })
        if (selectedType) {
          type = selectedType.name
        }
      }
    }
    const currentChallengeId = this.getCurrentChallengeId()

    return (
      <div className={styles.wrapper}>
        <Helmet title={getTitle(isNew)} />
        <div className={styles.title}>{getTitle(isNew)}</div>
        <div className={styles.textRequired}>* Required</div>
        <div className={styles.container}>
          { isLaunch && !isConfirm && (
            <Modal theme={theme}>
              <div className={styles.contentContainer}>
                <div className={styles.title}>Launch Challenge Confirmation</div>
                <span>{`Do you want to launch ${type} challenge "${challenge.name}"?`}</span>
                <div className={styles.buttonGroup}>
                  <div className={styles.button}>
                    <OutlineButton className={cn({ disabled: this.state.isSaving })} text={'Cancel'} type={'danger'} onClick={() => this.resetModal()} />
                  </div>
                  <div className={styles.button}>
                    <PrimaryButton text={this.state.isSaving ? 'Launching...' : 'Confirm'} type={'info'} onClick={() => this.onSubmitChallenge('Active')} />
                  </div>
                </div>
              </div>
            </Modal>
          ) } { isLaunch && isConfirm && (
            <Modal theme={theme}>
              <div className={cn(styles.contentContainer, styles.confirm)}>
                <div className={styles.title}>Success</div>
                <span>{ challenge.status === 'Draft' ? 'Your challenge is saved as draft' : 'We have scheduled your challenge and processed the payment'}</span>
                <div className={styles.buttonGroup}>
                  <div className={styles.buttonSizeA}>
                    <PrimaryButton text={'Back to Dashboard'} type={'info'} link={'/'} />
                  </div>
                  <div className={styles.buttonSizeA} onClick={() => this.resetModal()}>
                    <OutlineButton text={'View Challenge'} type={'success'} link={`/projects/${this.props.projectId}/challenges/${isConfirm}/edit`} />
                  </div>
                </div>
              </div>
            </Modal>
          ) }
          <div className={styles.formContainer}>
            <form name='challenge-info-form' noValidate autoComplete='off'>
              <div className={styles.group}>
                <TrackField challenge={challenge} onUpdateOthers={this.onUpdateOthers} />
                <TypeField types={metadata.challengeTypes} onUpdateSelect={this.onUpdateSelect} challenge={challenge} />
                <ChallengeNameField challenge={challenge} onUpdateInput={this.onUpdateInput} />
                <CopilotField challenge={challenge} copilots={metadata.members} onUpdateOthers={this.onUpdateOthers} />
                <ReviewTypeField reviewers={metadata.members} challenge={challenge} onUpdateOthers={this.onUpdateOthers} onUpdateSelect={this.onUpdateSelect} />
                <div className={styles.row}>
                  <div className={styles.tcCheckbox}>
                    <input name='isOpenAdvanceSettings' type='checkbox' id='isOpenAdvanceSettings' checked={isOpenAdvanceSettings} onChange={this.toggleAdvanceSettings} />
                    <label htmlFor='isOpenAdvanceSettings'>
                      <div>
                        View Advance Settings
                      </div>
                      <input type='hidden' />
                    </label>
                  </div>
                </div>
                { isOpenAdvanceSettings && (
                  <React.Fragment>
                    <TermsField terms={metadata.challengeTerms} challenge={challenge} onUpdateMultiSelect={this.onUpdateMultiSelect} />
                    <GroupsField groups={metadata.groups} onUpdateMultiSelect={this.onUpdateMultiSelect} challenge={challenge} />
                  </React.Fragment>
                ) }
                <ChallengeScheduleField templates={metadata.timelineTemplates} challengePhases={metadata.challengePhases} removePhase={this.removePhase} resetPhase={this.resetPhase} challenge={challenge} onUpdateSelect={this.onUpdateSelect} onUpdatePhase={this.onUpdatePhase} onUpdateOthers={this.onUpdateOthers} />
              </div>
              <div className={styles.group}>
                <div className={styles.title}>Public specification</div>
                <TextEditorField challengeTags={metadata.challengeTags} challenge={challenge} onUpdateCheckbox={this.onUpdateCheckbox} onUpdateInput={this.onUpdateInput} onUpdateDescription={this.onUpdateDescription} onUpdateMultiSelect={this.onUpdateMultiSelect} />
                { currentChallengeId && (
                  <AttachmentField
                    challenge={{ ...challenge, id: currentChallengeId }}
                    onUploadFile={uploadAttachment}
                    token={token}
                    removeAttachment={removeAttachment}
                  />
                )}
                <ChallengePrizesField challenge={challenge} onUpdateOthers={this.onUpdateOthers} />
                <CopilotFeeField challenge={challenge} onUpdateOthers={this.onUpdateOthers} />
                <ChallengeTotalField challenge={challenge} />
                { this.state.hasValidationErrors && !challenge.prizeSets.length && <div className={styles.error}>Should have at-least 1 prize value</div> }
              </div>
            </form>
          </div>
        </div>
        {!isLoading && this.state.hasValidationErrors && <div className={styles.error}>Please fix the errors before saving</div>}
        {!isLoading && <div className={styles.buttonContainer}>
          <div className={styles.button}>
            <OutlineButton text={'Cancel'} type={'danger'} link={'/'} />
          </div>
          <div className={styles.button}>
            <PrimaryButton text={(isNew || isDraft) ? 'Launch' : 'Update'} type={'info'} onClick={this.toggleLaunch} />
          </div>
        </div>}
      </div>
    )
  }
}

ChallengeEditor.defaultProps = {
  challengeId: null,
  attachments: [],
  failedToLoad: false,
  challengeResources: {}
}

ChallengeEditor.propTypes = {
  challengeDetails: PropTypes.object,
  challengeResources: PropTypes.arrayOf(PropTypes.object),
  isNew: PropTypes.bool.isRequired,
  isDraft: PropTypes.bool.isRequired,
  projectId: PropTypes.string.isRequired,
  challengeId: PropTypes.string,
  metadata: PropTypes.object.isRequired,
  isLoading: PropTypes.bool.isRequired,
  uploadAttachment: PropTypes.func.isRequired,
  removeAttachment: PropTypes.func.isRequired,
  attachments: PropTypes.arrayOf(PropTypes.shape()),
  token: PropTypes.string.isRequired,
  failedToLoad: PropTypes.bool,
  history: PropTypes.any.isRequired
}

export default withRouter(ChallengeEditor)
