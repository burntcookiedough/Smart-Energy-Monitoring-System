class EnergySimulation {
    constructor() {
        this.SETTINGS_KEY = 'aetherio_settings';

        // Initialize Default Settings if not present
        this.settings = JSON.parse(localStorage.getItem(this.SETTINGS_KEY)) || {
            spikeThreshold: 40,
            durationThreshold: 30
        };

        // Local state
        this.state = {
            // Appliance toggles
            appliances: {
                ac: true,
                light: true,
                washer: false,
                tv: true
            },

            // Dynamic consumption
            globalWatts: 0,
            hvacWatts: 0,
            lightWatts: 0,
            otherWatts: 0,

            cost: 14.70,
            wastedEnergy: 0.0,
            efficiencyScore: 92,
            isAnomaly: false,
            anomalyMessage: '',
            historicalData: this.generateBaseLoad(),
            alertHistory: []
        };

        this.lastTick = Date.now();
        this.timeMultiplier = 60;

        this.PEAK_PRICE = 10;
        this.OFF_PEAK_PRICE = 6;

        this.startEngine();
    }

    startEngine() {
        setInterval(() => this.tick(), 2000);
        setInterval(() => {
            if (Date.now() - this.lastTick > 100) this.interpolateCost();
        }, 100);
    }

    turnOffAnomaly() {
        if (!this.state.isAnomaly) return;
        this.state.isAnomaly = false;

        // If the AC is explicitly turned off during the anomaly, don't bring it up immediately
        this.state.hvacWatts = this.state.appliances.ac ? Math.floor(Math.random() * 500) + 1500 : 0;

        this.updateGlobal();
        this.broadcastEvent('anomaly_cleared');
    }

    triggerAnomaly(message = "AC Overload. Continuous peak draw exceeded duration thresholds.") {
        if (this.state.isAnomaly) return;

        // Turn on AC if off
        this.toggleAppliance('ac', true);

        this.state.isAnomaly = true;
        this.state.hvacWatts = 3200;
        this.state.anomalyMessage = message;
        this.state.efficiencyScore = Math.max(0, this.state.efficiencyScore - 15);
        this.state.wastedEnergy += 0.5; // Bump wasted energy logic

        const newAlert = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            message: message,
            watts: 3200,
            type: 'overload'
        };
        this.state.alertHistory.unshift(newAlert);
        if (this.state.alertHistory.length > 50) this.state.alertHistory.pop();

        this.updateGlobal();
        this.broadcastEvent('anomaly_detected');
    }

    toggleAppliance(appId, forcesState = null) {
        if (forcesState !== null) {
            this.state.appliances[appId] = forcesState;
        } else {
            this.state.appliances[appId] = !this.state.appliances[appId];
        }

        // If AC is turned off, clear anomaly
        if (appId === 'ac' && !this.state.appliances.ac && this.state.isAnomaly) {
            this.turnOffAnomaly();
        }

        this.tick(true); // Force an instant tick update
    }

    tick(forced = false) {
        if (this.state.isAnomaly) {
            this.state.hvacWatts = 3200 + Math.floor(Math.random() * 100 - 50);
            this.state.wastedEnergy += 0.05;
        } else {
            if (this.state.appliances.ac) {
                this.state.hvacWatts = 1800 + Math.floor(Math.random() * 200 - 100);
            } else {
                this.state.hvacWatts = 0; // Completely off
            }
            if (!forced && this.state.efficiencyScore < 98 && Math.random() > 0.7) {
                this.state.efficiencyScore += 1;
            }
        }

        // Calculate Light
        this.state.lightWatts = this.state.appliances.light ? 450 + Math.floor(Math.random() * 50 - 25) : 0;

        // Calculate Washer (Heavy when on)
        const washerWatts = this.state.appliances.washer ? 500 + Math.floor(Math.random() * 40 - 20) : 0;

        // Calculate TV
        const tvWatts = this.state.appliances.tv ? 200 + Math.floor(Math.random() * 20 - 10) : 0;

        this.state.otherWatts = washerWatts + tvWatts;

        this.updateGlobal();

        // Update Chart historical data array precisely
        let currentHour = new Date().getHours();
        this.state.historicalData[currentHour] = this.state.globalWatts;

        this.broadcastEvent('state_updated');
    }

    updateGlobal() {
        this.state.globalWatts = this.state.hvacWatts + this.state.lightWatts + this.state.otherWatts;
    }

    interpolateCost() {
        const now = Date.now();
        const deltaMs = now - this.lastTick;
        this.lastTick = now;

        const currentHour = new Date().getHours();
        const isPeak = (currentHour >= 18 && currentHour <= 22);
        const pricePerKwh = isPeak ? this.PEAK_PRICE : this.OFF_PEAK_PRICE;

        const kW = this.state.globalWatts / 1000;
        const hoursPassed = (deltaMs * this.timeMultiplier) / (1000 * 60 * 60);
        const costAdded = kW * hoursPassed * pricePerKwh;

        this.state.cost += (costAdded / 100);
    }

    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
    }

    clearAlertHistory() {
        this.state.alertHistory = [];
        this.broadcastEvent('state_updated');
    }

    broadcastEvent(eventType) {
        const event = new CustomEvent('aetherio_event', { detail: { type: eventType, state: this.state } });
        window.dispatchEvent(event);
    }

    generateBaseLoad() {
        return [
            300, 280, 280, 290, 310, 450,
            800, 1200, 1000, 950, 900, 950,
            1100, 1050, 1000, 1100, 1300, 1500,
            2200, 2500, 2400, 1800, 1200, 600
        ];
    }
}

window.aetherSimulation = new EnergySimulation();
