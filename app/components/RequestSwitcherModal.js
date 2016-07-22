import React, {PropTypes} from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';

import Modal from './base/Modal';
import ModalHeader from './base/ModalHeader';
import ModalBody from './base/ModalBody';
import MethodTag from './MethodTag';
import ModalComponent from './lib/ModalComponent';
import * as db from '../database';


class RequestSwitcherModal extends ModalComponent {
  constructor (props) {
    super(props);
    this.state = {
      searchString: '',
      matchedRequests: [],
      requestGroups: [],
      activeIndex: -1
    }
  }

  _setActiveIndex (activeIndex) {
    if (activeIndex < 0) {
      activeIndex = this.state.matchedRequests.length - 1;
    } else if (activeIndex >= this.state.matchedRequests.length) {
      activeIndex = 0;
    }

    this.setState({activeIndex});
  }

  _activateCurrentIndex () {
    if (this.state.matchedRequests.length) {
      // Activate the request if there is one
      this._activateRequest(this.state.matchedRequests[this.state.activeIndex]);
    } else {
      // Create the request if nothing matched
      const name = this.state.searchString;
      const parentId = this.props.activeRequestParentId;

      db.requestCreate({name, parentId}).then(request => {
        this._activateRequest(request);
      });
    }
  }

  _activateRequest (request) {
    if (!request) {
      return;
    }

    this.props.activateRequest(request);
    this.hide();
  }

  _handleChange (searchString) {
    const {workspaceId} = this.props;

    Promise.all([
      db.requestAll(),
      db.requestGroupAll()
    ]).then(([
      allRequests,
      allRequestGroups
    ]) => {
      // TODO: Support nested RequestGroups
      // Filter out RequestGroups that don't belong to this Workspace
      const requestGroups = allRequestGroups.filter(rg => rg.parentId === workspaceId);

      // Filter out Requests that don't belong to this Workspace
      const requests = allRequests.filter(r => {
        if (r.parentId === workspaceId) {
          return true;
        } else {
          return !!requestGroups.find(rg => rg._id === r.parentId);
        }
      });

      const parentId = this.props.activeRequestParentId;

      const matchedRequests = requests.sort(
        (a, b) => {
          // const rgA = requestGroups.find(rg => rg._id === a.parentId);
          // const rgB = requestGroups.find(rg => rg._id === b.parentId);
          // const rgAId = rgA ? rgA._id : null;
          // const rgBId = rgB ? rgB._id : null;

          // if (rgAId === parentId && rgBId !== parentId) {
          //   return -1;
          // } else if (rgBId === parentId && rgAId !== parentId) {
          //   return 1;

          if (a.parentId === b.parentId) {
            // Sort Requests by name inside of the same parent
            // TODO: Sort by quality of match (eg. start of string vs mid string, etc)
            return a.name > b.name ? 1 : -1;
          } else {
            // Sort RequestGroups by relevance if Request isn't in the same parent
            console.log(a.parentId, b.parentId, parentId);
            if (a.parentId === parentId) {
              return -1;
            } else if (b.parentId === parentId) {
              return 1;
            } else {
              return a.parentId > b.parentId ? -1 : 1;
            }
          }
        }
      ).filter(r => {
        if (!searchString) {
          return true;
        } else {
          return r.name.toLowerCase().indexOf(searchString.toLowerCase()) !== -1;
        }
      });

      const activeIndex = searchString ? 0 : -1;

      this.setState({
        activeIndex,
        matchedRequests,
        requestGroups,
        searchString
      });
    });
  }

  _focusInput () {
    // Need to focus after the Modal has shown, or else it won't exist yet
    setTimeout(() => {
      this.refs.input.focus();
    });
  }

  show () {
    throw new Error('show() not supposed to be called on RequestSwitcherModal');
  }

  toggle () {
    super.toggle();
    this._focusInput();
    this._handleChange('');
  }

  componentDidMount () {
    super.componentDidMount();

    ReactDOM.findDOMNode(this.refs.modal).addEventListener('keydown', e => {
      const keyCode = e.keyCode;

      if (keyCode === 38 || (keyCode === 9 && e.shiftKey)) {
        // Up or Shift+Tab
        this._setActiveIndex(this.state.activeIndex - 1);
      } else if (keyCode === 40 || keyCode === 9) {
        // Down or Tab
        this._setActiveIndex(this.state.activeIndex + 1);
      } else if (keyCode === 13) {
        // Enter
        this._activateCurrentIndex();
      } else {
        return;
      }

      e.preventDefault();
    })
  }

  render () {
    const {matchedRequests, requestGroups, searchString, activeIndex} = this.state;

    return (
      <Modal ref="modal" top={true} {...this.props}>
        <ModalHeader hideCloseButton={true}>
          <p className="pull-right txt-md">
            <span className="monospace">tab</span> or
            &nbsp;
            <span className="monospace">↑ ↓</span> &nbsp;to navigate
            &nbsp;&nbsp;&nbsp;
            <span className="monospace">↵</span> &nbsp;to select
            &nbsp;&nbsp;&nbsp;
            <span className="monospace">esc</span> to dismiss
          </p>
          <p>Jump To Request</p>
        </ModalHeader>
        <ModalBody className="pad request-switcher">
          <div className="form-control form-control--outlined no-margin">
            <input
              type="text"
              ref="input"
              value={searchString}
              onChange={e => this._handleChange(e.target.value)}
            />
          </div>
          <ul className="pad-top">
            {matchedRequests.map((r, i) => {
              const requestGroup = requestGroups.find(rg => rg._id === r.parentId);

              return (
                <li key={r._id}>
                  <button onClick={e => this._activateRequest(r)}
                          className={classnames('btn btn--compact wide text-left', {focus: activeIndex === i})}>
                    {requestGroup ? (
                      <div className="pull-right faint italic">
                        {requestGroup.name}
                        &nbsp;&nbsp;
                        <i className="fa fa-folder-o"></i>
                      </div>
                    ) : null}
                    <MethodTag method={r.method}/>
                    <strong>{r.name}</strong>
                  </button>
                </li>
              )
            })}
          </ul>

          {matchedRequests.length === 0 ? (
            <div className="text-center">
              <p>
                No matches found for <strong>{searchString}</strong>
              </p>
              <button className="btn btn--outlined btn--compact"
                      onClick={e => this._activateCurrentIndex()}>
                Create a request named {searchString}
              </button>
            </div>
          ) : null}
        </ModalBody>
      </Modal>
    );
  }
}

RequestSwitcherModal.propTypes = {
  activateRequest: PropTypes.func.isRequired,
  workspaceId: PropTypes.string.isRequired,
  activeRequestParentId: PropTypes.string.isRequired
};

export default RequestSwitcherModal;