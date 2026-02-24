class EnergySimulation {
    constructor() {
        this.SETTINGS_KEY = 'aetherio_settings';

        // Initialize Default Settings if not present
        this.settings = JSON.parse(localStorage.getItem(this.SETTINGS_KEY)) || {
            spikeThreshold: 40,
            durationThreshold: 30
        };

        // Local state (No localStorage for state anymore to fix race condition bugs!)
        this.state = {
            globalWatts: 2450,
            hvacWatts: 1800,
            lightWatts: 450,
            otherWatts: 200,
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
        this.state.hvacWatts = Math.floor(Math.random() * 500) + 1500;
        this.updateGlobal();
        this.broadcastEvent('anomaly_cleared');
    }

    triggerAnomaly(message = "HVAC system exceeded the spike threshold. Current draw: 2,800W.") {
        if (this.state.isAnomaly) return; // prevent duplicate
        this.state.isAnomaly = true;
        this.state.hvacWatts = 2800;
        this.state.anomalyMessage = message;
        this.state.efficiencyScore = Math.max(0, this.state.efficiencyScore - 15);
        this.state.wastedEnergy += 0.5; // Bump wasted energy logic

        const newAlert = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            message: message,
            watts: 2800,
            type: 'overload'
        };
        this.state.alertHistory.unshift(newAlert);
        if (this.state.alertHistory.length > 50) this.state.alertHistory.pop();

        this.updateGlobal();
        this.broadcastEvent('anomaly_detected');
    }

    tick() {
        if (this.state.isAnomaly) {
            this.state.hvacWatts = 2800 + Math.floor(Math.random() * 50 - 25);
            this.state.wastedEnergy += 0.05;
        } else {
            this.state.hvacWatts = 1800 + Math.floor(Math.random() * 200 - 100);
            if (this.state.efficiencyScore < 98 && Math.random() > 0.7) {
                this.state.efficiencyScore += 1;
            }
        }

        this.state.lightWatts = 450 + Math.floor(Math.random() * 50 - 25);
        this.state.otherWatts = 200 + Math.floor(Math.random() * 20 - 10);

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
