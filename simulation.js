/**
 * AetherIO - Smart Energy Monitoring System Simulation Engine
 * Handles real-time generation of power data, cost calculation, and anomaly detection.
 * Synchronizes state across browser tabs using localStorage.
 */

class EnergySimulation {
    constructor() {
        this.STORAGE_KEY = 'aetherio_simulation_state';
        this.SETTINGS_KEY = 'aetherio_settings';

        // Initialize Default Settings if not present
        this.settings = JSON.parse(localStorage.getItem(this.SETTINGS_KEY)) || {
            spikeThreshold: 40,
            durationThreshold: 30
        };

        // Initialize State
        this.state = JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || {
            globalWatts: 2450,
            hvacWatts: 1800,
            lightWatts: 450,
            otherWatts: 200,
            cost: 14.70,
            efficiencyScore: 92,
            isAnomaly: false,
            anomalyMessage: '',
            historicalData: this.generateBaseLoad(),
            alertHistory: []
        };

        // Timing variables
        this.lastTick = Date.now();
        this.timeMultiplier = 60; // 1 real second = 1 simulation minute (for cost accumulation)

        // Tariff Pricing: Peak (18:00 - 22:00) is ₹10/kWh, Off-Peak is ₹6/kWh
        this.PEAK_PRICE = 10;
        this.OFF_PEAK_PRICE = 6;

        this.startEngine();
        this.listenForSettings();
    }

    startEngine() {
        // Core simulation loop - runs every 2 seconds
        setInterval(() => {
            this.tick();
        }, 2000);

        // Frequent UI loop for cost ticker - runs every 100ms
        setInterval(() => {
            if (Date.now() - this.lastTick > 100) {
                this.interpolateCost();
            }
        }, 100);
    }

    turnOffAnomaly() {
        if (!this.state.isAnomaly) return;
        this.state.isAnomaly = false;
        this.state.hvacWatts = Math.floor(Math.random() * 500) + 1500; // Return to normal
        this.updateGlobal();
        this.saveState();
        this.broadcastEvent('anomaly_cleared');
    }

    triggerAnomaly(message = "HVAC system exceeded the spike threshold. Current draw: 2,800W.") {
        this.state.isAnomaly = true;
        this.state.hvacWatts = 2800;
        this.state.anomalyMessage = message;
        this.state.efficiencyScore = Math.max(0, this.state.efficiencyScore - 15);

        // Add to alert history
        const newAlert = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            message: message,
            watts: 2800,
            type: 'overload'
        };
        this.state.alertHistory.unshift(newAlert);

        // Keep only last 50 alerts
        if (this.state.alertHistory.length > 50) {
            this.state.alertHistory.pop();
        }

        this.updateGlobal();
        this.saveState();

        // Notify other tabs immediately
        this.broadcastEvent('anomaly_detected');
    }

    tick() {
        if (this.state.isAnomaly) {
            // Keep it high if there's an active anomaly
            this.state.hvacWatts = 2800 + Math.floor(Math.random() * 50 - 25);
        } else {
            // Normal fluctuation
            this.state.hvacWatts = 1800 + Math.floor(Math.random() * 200 - 100);
        }

        this.state.lightWatts = 450 + Math.floor(Math.random() * 50 - 25);
        this.state.otherWatts = 200 + Math.floor(Math.random() * 20 - 10);

        this.updateGlobal();

        // If normal, slowly recover efficiency score
        if (!this.state.isAnomaly && this.state.efficiencyScore < 98) {
            if (Math.random() > 0.7) {
                this.state.efficiencyScore += 1;
            }
        }

        this.saveState();
        this.broadcastEvent('state_updated');
    }

    updateGlobal() {
        this.state.globalWatts = this.state.hvacWatts + this.state.lightWatts + this.state.otherWatts;
    }

    interpolateCost() {
        // Calculate the simulated time passed
        const now = Date.now();
        const deltaMs = now - this.lastTick;
        this.lastTick = now;

        // Current Hour (Use actual Date object for realistic pricing match)
        const currentHour = new Date().getHours();
        const isPeak = (currentHour >= 18 && currentHour <= 22);
        const pricePerKwh = isPeak ? this.PEAK_PRICE : this.OFF_PEAK_PRICE;

        // Global Watts -> kW -> kWh per millisecond -> Cost
        const kW = this.state.globalWatts / 1000;
        const hoursPassed = (deltaMs * this.timeMultiplier) / (1000 * 60 * 60);
        const costAdded = kW * hoursPassed * pricePerKwh;

        // This makes the ticker move visually smoothly
        this.state.cost += (costAdded / 100);
        // We do not save to local storage every 100ms to avoid performance hit, 
        // rely on the tick() to sink the master cost.
    }

    saveState() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    }

    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings));
    }

    listenForSettings() {
        window.addEventListener('storage', (e) => {
            if (e.key === this.SETTINGS_KEY) {
                this.settings = JSON.parse(e.newValue);
            }
            if (e.key === this.STORAGE_KEY) {
                this.state = JSON.parse(e.newValue);
                this.broadcastEvent('state_updated'); // Re-render UI
            }
        });

        // Listen for internal broadcasts within the same tab
        window.addEventListener('aetherio_event', (e) => {
            if (e.detail.type === 'trigger_anomaly') {
                this.triggerAnomaly();
            } else if (e.detail.type === 'clear_anomaly') {
                this.turnOffAnomaly();
            } else if (e.detail.type === 'clear_alert_history') {
                this.clearAlertHistory();
            }
        });
    }

    clearAlertHistory() {
        this.state.alertHistory = [];
        this.saveState();
        this.broadcastEvent('state_updated');
    }

    broadcastEvent(eventType) {
        const event = new CustomEvent('aetherio_event', { detail: { type: eventType, state: this.state } });
        window.dispatchEvent(event);
    }

    generateBaseLoad() {
        // Base load pattern used in analytics chart
        return [
            300, 280, 280, 290, 310, 450,
            800, 1200, 1000, 950, 900, 950,
            1100, 1050, 1000, 1100, 1300, 1500,
            2200, 2500, 2400, 1800, 1200, 600
        ];
    }
}

// Instantiate globally
window.aetherSimulation = new EnergySimulation();
