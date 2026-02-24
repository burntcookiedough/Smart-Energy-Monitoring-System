document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------
    // 1. View Routing
    // ----------------------------------------------------------------
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const headerTitle = document.getElementById('header-title');
    const headerSubtitle = document.getElementById('header-subtitle');
    const clearAlertsBtn = document.getElementById('clear-alerts');

    function switchView(viewId) {
        views.forEach(v => v.classList.remove('active'));
        navItems.forEach(n => n.classList.remove('active'));

        document.getElementById(`view-${viewId}`).classList.add('active');
        document.querySelector(`.nav-item[data-view="${viewId}"]`).classList.add('active');

        // Update Header Context
        if (viewId === 'dashboard') {
            headerTitle.innerText = 'AetherIO Energy';
            headerSubtitle.innerText = 'Intelligent monitoring. Sustainable living.';
            clearAlertsBtn.style.display = 'none';
        } else if (viewId === 'analytics') {
            headerTitle.innerText = 'Consumption Analytics';
            headerSubtitle.innerText = 'AI-driven insights and anomaly tracking.';
            clearAlertsBtn.style.display = 'none';
        } else if (viewId === 'alerts') {
            headerTitle.innerText = 'Alert History';
            headerSubtitle.innerText = 'System anomaly and overload events log.';
            clearAlertsBtn.style.display = window.aetherSimulation.state.alertHistory.length > 0 ? 'inline-block' : 'none';
        } else if (viewId === 'settings') {
            headerTitle.innerText = 'Appliance Simulation';
            headerSubtitle.innerText = 'Toggle physical appliances and simulate overload events.';
            clearAlertsBtn.style.display = 'none';
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.getAttribute('data-view'));
        });
    });

    // ----------------------------------------------------------------
    // 2. Chart Initialization (Analytics)
    // ----------------------------------------------------------------
    const ctx = document.getElementById('energyChart').getContext('2d');
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(94, 234, 212, 0.4)');
    gradient.addColorStop(1, 'rgba(94, 234, 212, 0.0)');

    const peakHoursPlugin = {
        id: 'peakHours',
        beforeDraw: (chart) => {
            const ctx = chart.canvas.getContext('2d');
            const xAxis = chart.scales.x;
            const yAxis = chart.scales.y;
            const left = xAxis.getPixelForValue(18);
            const right = xAxis.getPixelForValue(22);
            ctx.save();
            ctx.fillStyle = 'rgba(129, 140, 248, 0.1)';
            ctx.fillRect(left, yAxis.top, right - left, yAxis.bottom - yAxis.top);
            ctx.restore();
        }
    };

    const chart = new Chart(ctx, {
        type: 'line',
        plugins: [peakHoursPlugin],
        data: {
            labels: labels,
            datasets: [{
                label: 'Power Consumption (W)',
                data: [...window.aetherSimulation.state.historicalData],
                borderColor: '#5EEAD4',
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: Array(24).fill('#FFFFFF'),
                pointBorderColor: Array(24).fill('#5EEAD4'),
                pointRadius: Array(24).fill(0),
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E293B', padding: 12,
                    titleFont: { family: 'Plus Jakarta Sans', size: 14 },
                    bodyFont: { family: 'Plus Jakarta Sans', size: 14 },
                    callbacks: {
                        label: function (context) {
                            let label = context.parsed.y + ' W';
                            if (window.aetherSimulation.state.isAnomaly && context.dataIndex === new Date().getHours()) {
                                label += ' ⚠️ ANOMALY DETECTED';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false, drawBorder: false }, ticks: { font: { family: 'Plus Jakarta Sans' }, color: '#64748B' } },
                y: { grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false }, ticks: { font: { family: 'Plus Jakarta Sans' }, color: '#64748B', stepSize: 500 } }
            }
        }
    });

    // ----------------------------------------------------------------
    // 3. Settings Interface
    // ----------------------------------------------------------------
    const spikeSlider = document.getElementById('spike-threshold');
    const durSlider = document.getElementById('duration-threshold');
    const spikeVal = document.getElementById('spike-val');
    const durVal = document.getElementById('dur-val');

    spikeSlider.value = window.aetherSimulation.settings.spikeThreshold;
    durSlider.value = window.aetherSimulation.settings.durationThreshold;
    spikeVal.innerText = spikeSlider.value + '%';
    durVal.innerText = durSlider.value + ' mins';

    spikeSlider.addEventListener('input', (e) => spikeVal.innerText = e.target.value + '%');
    durSlider.addEventListener('input', (e) => durVal.innerText = e.target.value + ' mins');

    document.getElementById('save-thresholds-btn').addEventListener('click', () => {
        window.aetherSimulation.saveSettings({
            spikeThreshold: parseInt(spikeSlider.value),
            durationThreshold: parseInt(durSlider.value)
        });
        showToast('✅ Settings Saved', 'Thresholds updated successfully.', '#10B981', '#D1FAE5');
    });

    const anomalyBtn = document.getElementById('trigger-anomaly-btn');
    const clearBtn = document.getElementById('clear-anomaly-btn');

    anomalyBtn.addEventListener('click', () => window.aetherSimulation.triggerAnomaly());
    clearBtn.addEventListener('click', () => window.aetherSimulation.turnOffAnomaly());
    clearAlertsBtn.addEventListener('click', () => window.aetherSimulation.clearAlertHistory());

    // ----------------------------------------------------------------
    // 3.5 Physical Appliance Toggles
    // ----------------------------------------------------------------
    const toggleAc = document.getElementById('toggle-ac');
    const toggleLight = document.getElementById('toggle-light');
    const toggleWasher = document.getElementById('toggle-washer');
    const toggleTv = document.getElementById('toggle-tv');

    toggleAc.addEventListener('change', (e) => window.aetherSimulation.toggleAppliance('ac', e.target.checked));
    toggleLight.addEventListener('change', (e) => window.aetherSimulation.toggleAppliance('light', e.target.checked));
    toggleWasher.addEventListener('change', (e) => window.aetherSimulation.toggleAppliance('washer', e.target.checked));
    toggleTv.addEventListener('change', (e) => window.aetherSimulation.toggleAppliance('tv', e.target.checked));

    // ----------------------------------------------------------------
    // 4. State & DOM Updating Loop
    // ----------------------------------------------------------------
    // Fast Ticker Loop for Cost (Smoother than main tick)
    setInterval(() => {
        document.getElementById('cost-ticker').innerText = window.aetherSimulation.state.cost.toFixed(2);
    }, 100);

    window.addEventListener('aetherio_event', (e) => {
        const state = e.detail.state;
        const type = e.detail.type;

        // Dashboard Updates
        document.getElementById('global-watts').innerText = Math.round(state.globalWatts).toLocaleString();

        const hvacEl = document.getElementById('hvac-watts');
        const hvacStatus = document.getElementById('hvac-status');
        hvacEl.innerHTML = `${Math.round(state.hvacWatts).toLocaleString()} <span class="stat-unit">W</span>`;
        if (state.isAnomaly) {
            hvacStatus.innerHTML = `<span style="color: var(--accent); font-weight: 600;">⚠️ Anomaly/Overload Detected</span>`;
            hvacEl.style.color = 'var(--accent)';
        } else if (!state.appliances.ac) {
            hvacStatus.innerHTML = `Powered Off`;
            hvacEl.style.color = '#94A3B8';
        } else {
            hvacStatus.innerHTML = `Running optimal cycles`;
            hvacEl.style.color = '';
        }

        const lightEl = document.getElementById('light-watts');
        lightEl.innerHTML = `${Math.round(state.lightWatts).toLocaleString()} <span class="stat-unit">W</span>`;
        if (!state.appliances.light) {
            lightEl.style.color = '#94A3B8';
        } else {
            lightEl.style.color = '';
        }

        const scoreEl = document.getElementById('efficiency-score');
        scoreEl.innerHTML = `${state.efficiencyScore}<span class="stat-unit" style="color: rgba(255,255,255,0.7);">/100</span>`;

        // Analytics Chart
        const cHour = new Date().getHours();
        chart.data.datasets[0].data = [...state.historicalData];
        if (state.isAnomaly) {
            chart.data.datasets[0].pointBackgroundColor[cHour] = '#FDA4AF';
            chart.data.datasets[0].pointBorderColor[cHour] = '#FDA4AF';
            chart.data.datasets[0].pointRadius[cHour] = 6;
        } else {
            chart.data.datasets[0].pointBackgroundColor[cHour] = '#FFFFFF';
            chart.data.datasets[0].pointBorderColor[cHour] = '#5EEAD4';
            chart.data.datasets[0].pointRadius[cHour] = 0;
        }
        chart.update();

        document.getElementById('wasted-energy').innerHTML = `${state.wastedEnergy.toFixed(2)} <span style="font-size: 1rem; color: #BE123C;">kWh</span>`;

        // Settings Buttons & Toggles Sync
        toggleAc.checked = state.appliances.ac;
        toggleLight.checked = state.appliances.light;
        toggleWasher.checked = state.appliances.washer;
        toggleTv.checked = state.appliances.tv;

        if (state.isAnomaly) {
            clearBtn.style.display = 'block';
            anomalyBtn.style.opacity = '0.5';
        } else {
            clearBtn.style.display = 'none';
            anomalyBtn.style.opacity = '1';
        }

        // Alerts List
        renderAlerts(state.alertHistory);

        // Toasts
        if (type === 'anomaly_detected') {
            showToast('⚠️ Anomaly Detected', state.anomalyMessage, '#BE123C', '#FFF1F2');
        } else if (type === 'anomaly_cleared') {
            showToast('✅ System Normal', 'HVAC overload resolved.', '#10B981', '#D1FAE5');
        }
    });

    // ----------------------------------------------------------------
    // 5. Helpers
    // ----------------------------------------------------------------
    function renderAlerts(history) {
        const container = document.getElementById('alerts-container');
        container.innerHTML = '';

        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <h3>All Clear</h3>
                    <p style="margin-top: 0.5rem;">No anomalies or overloads detected recently.</p>
                </div>
            `;
            const activeView = document.querySelector('.nav-item.active').getAttribute('data-view');
            if (activeView === 'alerts') clearAlertsBtn.style.display = 'none';
            return;
        }

        const activeView = document.querySelector('.nav-item.active').getAttribute('data-view');
        if (activeView === 'alerts') clearAlertsBtn.style.display = 'inline-block';

        history.forEach(alert => {
            const date = new Date(alert.timestamp);
            const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString();

            const el = document.createElement('div');
            el.className = 'alert-item';
            el.innerHTML = `
                <div class="alert-info">
                    <div class="alert-icon">⚠️</div>
                    <div>
                        <h4>System Overload</h4>
                        <p>${alert.message}</p>
                    </div>
                </div>
                <div class="meta-info">
                    <div class="alert-value">${alert.watts.toLocaleString()} W Peak</div>
                    <div class="alert-time">${formattedTime}</div>
                </div>
            `;
            container.appendChild(el);
        });
    }

    function showToast(title, message, color, bgColor) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <div class="toast-icon" style="background: ${bgColor}; color: ${color};">
                ${title.includes('⚠️') ? '⚠️' : '✅'}
            </div>
            <div class="toast-content">
                <h4 style="color: var(--text); padding-top: 5px;">${title.replace('⚠️', '').replace('✅', '').trim()}</h4>
                <p>${message}</p>
            </div>
        `;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    // Initial UI Render Sync
    window.aetherSimulation.tick();
});
