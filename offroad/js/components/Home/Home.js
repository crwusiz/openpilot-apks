import React, { Component } from 'react';
import {
    Linking,
    Text,
    View,
    ScrollView,
    NetInfo,
} from 'react-native';
import { connect } from 'react-redux';
import { NavigationActions } from 'react-navigation';

// Native Modules
import ChffrPlus from '../../native/ChffrPlus';
import { Params } from '../../config';

import {
    fetchAccount,
    fetchDeviceStats,
    updateConnectionState,
    updateUpdateIsAvailable,
} from '../../store/host/actions';
import { refreshParams, ALERT_PARAMS } from '../../store/params/actions';

// UI
import { HOME_BUTTON_GRADIENT } from '../../styles/gradients';
import X from '../../themes';
import Styles from './HomeStyles';
import { formatCommas } from '../../utils/number';
import { mToKm } from '../../utils/conversions';

class Home extends Component {
    static navigationOptions = {
      header: null,
    };

    constructor(props) {
        super(props);

        this.state = {
            alertsVisible: false,
            alerts: [],
        };
    }

    async componentWillMount() {
        await this.props.fetchAccount();
        await this.props.refreshAlertParams();
        await this.props.fetchDeviceStats();
        await this.props.updateUpdateParams();
    }

    async componentDidMount() {
        await this.refreshOffroadParams();
        NetInfo.isConnected.addEventListener('connectionChange', this._handleConnectionChange);
        await NetInfo.isConnected.fetch().then(this._handleConnectionChange);
        this.checkOffroadParams = setInterval(() => {
            this.refreshOffroadParams();
        }, 5000);
    }

    componentWillUnmount() {
        NetInfo.isConnected.removeEventListener('connectionChange', this._handleConnectionChange);
        clearInterval(this.checkOffroadParams);
    }

    _handleConnectionChange = (isConnected) => {
        console.log('Connection status is ' + (isConnected ? 'online' : 'offline') + ' ' + isConnected);
        this.props.updateConnectionState(isConnected);
        if (isConnected) {
          this.props.fetchDeviceStats();
        }
    }

    refreshOffroadParams = async () => {
        await this.props.refreshAlertParams();
        const { params } = this.props;
        let oldAlerts = this.state.alerts;

        let alerts = [];
        for (let i = 0; i < ALERT_PARAMS.length; i++) {
          const name = ALERT_PARAMS[i];
          let value = params[name];
          if (typeof value === 'string') {
            const alert = JSON.parse(value);
            if (alert.severity > -1) {
              alerts.push({ name, ...alert });
            }
          }
        }

        let oldAlertNames = oldAlerts.map(function(alert) { return alert.name });
        let newAlertNames = alerts.map(function(alert) { return alert.name });
        let alertDiffers = function(alertName, idx) {
          return alertName !== newAlertNames[idx]
        };
        if (oldAlertNames.length !== newAlertNames.length
            || oldAlertNames.some(alertDiffers)) {
          this.setState({ alerts, alertsVisible: alerts.length > 0 });
        }
    }

    handleAlertButtonPressed = () => {
        this.setState({ alertsVisible: true });
    }

    handleHideAlertsPressed = () => {
        this.setState({ alertsVisible: false });
    }

    handleFinishPairingPressed = () => {
        this.props.openPairing();
    }

    render() {
        const {
            alerts,
            alertsVisible,
        } = this.state;

        const {
            hasPrime,
            isPaired,
            summaryDate,
            summaryCity,
            params,
            isConnected,
            deviceStats,
            username,
            commaPoints,
            updateIsAvailable,
            updateReleaseNotes,
        } = this.props;

        const softwareName = !!parseInt(params.Passive) ? '대시캠' : '오픈파일럿';
        const softwareString = `${ softwareName } v${ params.Version }`;
        const hasDeviceStats = typeof(deviceStats.all) !== 'undefined';
        const isMetric = !!parseInt(params.IsMetric);

        const homeHeaderStyles = [
            Styles.homeHeader,
            alertsVisible && Styles.homeHeaderSmall,
        ];

        const homeBodyStyles = [
            Styles.homeBody,
            (alertsVisible || !isConnected) && Styles.homeBodyDark,
        ];

        return (
            <X.Gradient color='flat_blue'>
                <View style={ Styles.home }>
                    <View style={ homeHeaderStyles }>
                        <View style={ Styles.homeHeaderIntro }>
                            <View style={ Styles.homeHeaderIntroDate }>
                                <X.Text
                                    color='white'
                                    weight='light'>
                                    { summaryDate }
                                </X.Text>
                            </View>
                            <View style={ Styles.homeHeaderIntroCity }>
                                { !alertsVisible ? (
                                    <X.Text
                                        color='white'
                                        size={ summaryCity.length > 20 ? 'big' : 'jumbo' }
                                        numberOfLines={ 1 }
                                        weight='semibold'>
                                        { summaryCity }
                                    </X.Text>
                                ) : null }
                            </View>
                        </View>
                        <View style={ Styles.homeHeaderDetails }>
                            <View style={ Styles.homeHeaderDetailsVersion }>
                                { !updateIsAvailable ? (
                                    <X.Image
                                        style={ Styles.homeHeaderDetailsVersionIcon }
                                        isFlex={ false }
                                        source={ require('../../img/icon_checkmark.png') } />
                                ) : null }
                                <X.Text
                                    color='white'
                                    size='tiny'>
                                    { softwareString }
                                </X.Text>
                            </View>
                            { updateIsAvailable ? (
                                <View style={ Styles.homeHeaderDetailsAction }>
                                    <X.Button
                                        size='smaller'
                                        color='lightGrey'
                                        onPress={ () => this.props.handleUpdateButtonPressed(updateReleaseNotes) }>
                                        <X.Text
                                            color='darkBlue'
                                            size='tiny'
                                            weight='semibold'>
                                            업데이트 사용가능
                                        </X.Text>
                                    </X.Button>
                                </View>
                            ) : null }
                            { alerts.length > 0 && !alertsVisible ? (
                                <View style={ Styles.homeHeaderDetailsAction }>
                                    <X.Button
                                        size='smaller'
                                        color='redAlert'
                                        onPress={ this.handleAlertButtonPressed }>
                                        <X.Text
                                            color='white'
                                            size='tiny'
                                            weight='semibold'>
                                            { alerts.length } { alerts.length > 1 ? '경고' : '경고' }
                                        </X.Text>
                                    </X.Button>
                                </View>
                            ) : null }
                        </View>
                    </View>
                    { alertsVisible ? (
                        <View style={ homeBodyStyles }>
                            <ScrollView style={ Styles.homeBodyAlerts }>
                                { alerts.sort((a, b) => (a.severity > b.severity) ? -1 : 1).map((alert, i) => {
                                    const alertStyle = [
                                        Styles.homeBodyAlert,
                                        alert.severity == 1 && Styles.homeBodyAlertRed,
                                    ];
                                    return (
                                        <View
                                            style={ alertStyle }
                                            key={ `alert_${ i }` }>
                                            <X.Image
                                                isFlex={ false }
                                                style={ Styles.homeBodyAlertIcon }
                                                source={ require('../../img/icon_warning.png') } />
                                            <X.Text
                                                color='white'
                                                size='medium'
                                                weight='semibold'
                                                style={ Styles.homeBodyAlertText }>
                                                { alert.text }
                                            </X.Text>
                                        </View>
                                    )
                                })}
                                <View style={ Styles.homeBodyAlertActions }>
                                    <X.Button
                                        size='tiny'
                                        onPress={ this.handleHideAlertsPressed }
                                        style={ Styles.homeBodyAlertAction }>
                                        경고 숨김
                                    </X.Button>
                                </View>
                            </ScrollView>
                        </View>
                    ) : !isConnected ? (
                        <View style={ homeBodyStyles }>
                            <View style={ Styles.homeBodyDisconnected }>
                                <X.Text
                                    color='white'
                                    size='jumbo'
                                    weight='semibold'>
                                    {         Enjoy easy driving ~~ }
                                </X.Text>
                                <X.Text
                                    color='lightGrey700'
                                    size='medium'
                                    style={ Styles.homeBodyDisconnectedContext }>
                                    { 항상 핸들을 잡고 도로를 주시하세요{'\n'}{'\n'}한글화 : 로웰 ( crwusiz ) }
                                </X.Text>
                            </View>
                        </View>
                    ) : (
                      <View style={ homeBodyStyles }>
                          <View style={ [Styles.homeBodyStats, !isPaired && Styles.homeBodyStatsUnpaired ] }>
                              <View style={ Styles.homeBodyStatsHeader }>
                                  <X.Text
                                      color='white'
                                      size='tiny'
                                      weight='semibold'>
                                      지난주
                                  </X.Text>
                              </View>
                              <View style={ Styles.homeBodyStatsRow }>
                                  <View style={ Styles.homeBodyStat }>
                                      <X.Text
                                          color='white'
                                          size='big'
                                          weight='semibold'
                                          style={ Styles.homeBodyStatNumber }>
                                          { hasDeviceStats ? formatCommas(deviceStats.week.routes) : '0' }
                                      </X.Text>
                                      <X.Text
                                          color='lightGrey700'
                                          size='tiny'
                                          style={ Styles.homeBodyStatLabel }>
                                          주행수
                                      </X.Text>
                                  </View>
                                  <View style={ Styles.homeBodyStat }>
                                      <X.Text
                                          color='white'
                                          size='big'
                                          weight='semibold'
                                          style={ Styles.homeBodyStatNumber }>
                                          { hasDeviceStats ? formatCommas(Math.floor(
                                                isMetric ? mToKm(deviceStats.week.distance): deviceStats.week.distance
                                            )) : '0' }
                                      </X.Text>
                                      <X.Text
                                          color='lightGrey700'
                                          size='tiny'
                                          style={ Styles.homeBodyStatLabel }>
                                          { isMetric ? 'km' : 'MILES' }
                                      </X.Text>
                                  </View>
                                  <View style={ Styles.homeBodyStat }>
                                      <X.Text
                                          color='white'
                                          size='big'
                                          weight='semibold'
                                          style={ Styles.homeBodyStatNumber }>
                                          { hasDeviceStats ? formatCommas(Math.floor(deviceStats.week.minutes / 60)) : '0' }
                                      </X.Text>
                                      <X.Text
                                          color='lightGrey700'
                                          size='tiny'
                                          style={ Styles.homeBodyStatLabel }>
                                          시간
                                      </X.Text>
                                  </View>
                              </View>
                              <X.Line
                                  color='light'
                                  spacing='none' />
                              <View style={ Styles.homeBodyStatsHeader }>
                                  <X.Text
                                      color='white'
                                      size='tiny'
                                      weight='semibold'>
                                      전체 시간
                                  </X.Text>
                              </View>
                              <View style={ Styles.homeBodyStatsRow }>
                                  <View style={ Styles.homeBodyStat }>
                                      <X.Text
                                          color='white'
                                          size='medium'
                                          weight='semibold'
                                          style={ Styles.homeBodyStatNumber }>
                                          { hasDeviceStats ? formatCommas(deviceStats.all.routes) : '0' }
                                      </X.Text>
                                      <X.Text
                                          color='lightGrey700'
                                          size='tiny'
                                          style={ Styles.homeBodyStatLabel }>
                                          주행수
                                      </X.Text>
                                  </View>
                                  <View style={ Styles.homeBodyStat }>
                                      <X.Text
                                          color='white'
                                          size='medium'
                                          weight='semibold'
                                          style={ Styles.homeBodyStatNumber }>
                                          { hasDeviceStats ? formatCommas(Math.floor(
                                                isMetric ? mToKm(deviceStats.all.distance): deviceStats.all.distance
                                            )) : '0' }
                                      </X.Text>
                                      <X.Text
                                          color='lightGrey700'
                                          size='tiny'
                                          style={ Styles.homeBodyStatLabel }>
                                          { isMetric ? 'km' : 'MILES' }
                                      </X.Text>
                                  </View>
                                  <View style={ Styles.homeBodyStat }>
                                      <X.Text
                                          color='white'
                                          size='medium'
                                          weight='semibold'
                                          style={ Styles.homeBodyStatNumber }>
                                          { hasDeviceStats ? formatCommas(Math.floor(deviceStats.all.minutes / 60)) : '0' }
                                      </X.Text>
                                      <X.Text
                                          color='lightGrey700'
                                          size='tiny'
                                          style={ Styles.homeBodyStatLabel }>
                                          시간
                                      </X.Text>
                                  </View>
                              </View>
                          </View>
                          { isPaired && hasPrime ? (
                              <View style={ Styles.homeBodyAccount }>
                                  <View style={ Styles.homeBodyAccountPoints }>
                                      <X.Text
                                          color='white'
                                          size='big'
                                          weight='semibold'
                                          style={ Styles.homeBodyAccountPointsNumber }>
                                          { typeof(commaPoints) !== 'undefined' ? (
                                            formatCommas(commaPoints)
                                          ) : '--' }
                                      </X.Text>
                                      <X.Text
                                          color='lightGrey700'
                                          size='tiny'
                                          style={ Styles.homeBodyAccountPointsLabel }>
                                          COMMA 포인트
                                      </X.Text>
                                  </View>
                                  <View style={ Styles.homeBodyAccountDetails }>
                                      { username !== null ? (
                                          <X.Text
                                              color='white'
                                              size='small'
                                              weight='semibold'
                                              style={ Styles.homeBodyAccountDetailsName }>
                                              @{ username }
                                          </X.Text>
                                      ) : null }
                                  </View>
                              </View>
                          ) : isPaired ? (
                              <View style={ [Styles.homeBodyAccount, Styles.homeBodyAccountDark] }>
                                  <View style={ Styles.homeBodyAccountUpgrade }>
                                      <X.Text
                                          color='white'
                                          size='medium'
                                          weight='semibold'
                                          style={ Styles.homeBodyAccountUpgradeTitle }>
                                          지금 업데이트
                                      </X.Text>
                                      <X.Text
                                          color='white'
                                          size='tiny'
                                          weight='light'
                                          style={ Styles.homeBodyAccountUpgradeContext }>
                                          comma prime 맴버가 되어 comma connect앱에서 고급 기능을 추가하세요!
                                      </X.Text>
                                      <View style={ Styles.homeBodyAccountUpgradeFeatures }>
                                          <View style={ Styles.homeBodyAccountUpgradeFeature }>
                                              <X.Image
                                                  isFlex={ false }
                                                  style={ Styles.homeBodyAccountUpgradeIcon }
                                                  source={ require('../../img/icon_checkmark.png') } />
                                              <X.Text
                                                  color='white'
                                                  size='tiny'
                                                  weight='semibold'>
                                                  원격 접속
                                              </X.Text>
                                          </View>
                                          <View style={ Styles.homeBodyAccountUpgradeFeature }>
                                              <X.Image
                                                  isFlex={ false }
                                                  style={ Styles.homeBodyAccountUpgradeIcon }
                                                  source={ require('../../img/icon_checkmark.png') } />
                                              <X.Text
                                                  color='white'
                                                  size='tiny'
                                                  weight='semibold'>
                                                  저장기간 : 1 년
                                              </X.Text>
                                          </View>
                                          <View style={ Styles.homeBodyAccountUpgradeFeature }>
                                              <X.Image
                                                  isFlex={ false }
                                                  style={ Styles.homeBodyAccountUpgradeIcon }
                                                  source={ require('../../img/icon_checkmark.png') } />
                                              <X.Text
                                                  color='white'
                                                  size='tiny'
                                                  weight='semibold'>
                                                  개발자 혜택
                                              </X.Text>
                                          </View>
                                      </View>
                                  </View>
                              </View>
                          ) : (
                              <View style={ Styles.homeBodyAccount }>
                                  <X.Button
                                      color='transparent'
                                      size='full'
                                      onPress={ this.handleFinishPairingPressed }>
                                      <X.Gradient
                                          colors={ HOME_BUTTON_GRADIENT }
                                          style={ Styles.homeBodyAccountPairButton }>
                                          <View style={ Styles.homeBodyAccountPairButtonHeader }>
                                              <X.Text
                                                  color='white'
                                                  size='medium'
                                                  weight='semibold'>
                                                  설치 완료
                                              </X.Text>
                                              <X.Image
                                                  isFlex={ false }
                                                  style={ Styles.homeBodyAccountPairButtonIcon }
                                                  source={ require('../../img/icon_chevron_right.png') } />
                                          </View>
                                          <X.Text
                                              color='white'
                                              size='tiny'
                                              weight='light'
                                              style={ Styles.homeBodyAccountPairButtonContext }>
                                              comma connect {'\n'}앱으로 페어링하세요
                                          </X.Text>
                                      </X.Gradient>
                                  </X.Button>
                              </View>
                          ) }
                      </View>
                    )}
                </View>
            </X.Gradient>
        )
    }
}

const mapStateToProps = (state) => {
    return {
        username: state.host.account && state.host.account.username,
        commaPoints: state.host.account && state.host.account.points,
        hasPrime: state.host.device && state.host.device.prime,
        isPaired: state.host.device && state.host.device.is_paired,
        latitude: state.environment.latitude,
        longitude: state.environment.longitude,
        summaryCity: state.environment.city,
        summaryDate: state.environment.date,
        params: state.params.params,
        isConnected: state.host.isConnected,
        deviceStats: state.host.deviceStats,
        account: state.host.account,
        updateIsAvailable: state.host.updateIsAvailable,
        updateReleaseNotes: state.host.updateReleaseNotes,
    };
};

const mapDispatchToProps = (dispatch) => ({
    openPairing: () => {
        dispatch(NavigationActions.navigate({ routeName: 'SetupQr' }))
    },
    updateConnectionState: (isConnected) => {
        dispatch(updateConnectionState(isConnected));
    },
    updateUpdateParams: async () => {
        await dispatch(updateUpdateIsAvailable());
    },
    fetchAccount: async () => {
        await dispatch(fetchAccount());
    },
    fetchDeviceStats: async () => {
        await dispatch(fetchDeviceStats());
    },
    refreshAlertParams: async () => {
        await dispatch(refreshParams(ALERT_PARAMS));
    },
    handleUpdateButtonPressed: (releaseNotes) => {
        dispatch(NavigationActions.navigate({
            routeName: 'UpdatePrompt',
            params: { releaseNotes }
        }));
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(Home);
