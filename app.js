const app = {
    timers: [],
    recipes: [],
    shoppingList: [],
    productsDB: [], // NUOVO: Database Prodotti per Auto-Completamento
    editingTimerId: null,
    editingRecipeId: null,
    viewingRecipeId: null,
    editingShopItemId: null, // Per distinguere nuovo prodotto da modifica
    tempAlarms: [],
    tempImageBase64: null,
    tempRecipeImageBase64: null,
    tempShopImageBase64: null, // Immagine carrello

    // Variabili Timer
    activeTimerInterval: null,
    activeTimerData: null,
    timeRemaining: 0,
    totalTimeStart: 0,
    isPaused: false,
    audioCtx: null,

    async init() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(err => console.log(err));
        }

        const savedData = await idbKeyval.get('timerpro_data');
        if (savedData) {
            this.timers = savedData.timers || [];
            this.recipes = savedData.recipes || [];
            this.shoppingList = savedData.shoppingList || [];
            this.productsDB = savedData.productsDB || [];
        }

        this.renderHome();
    },

    hideAllViews() {
        document.getElementById('home-view').classList.add('hidden');
        document.getElementById('ricettario-view').classList.add('hidden');
        document.getElementById('shopping-view').classList.add('hidden');
        document.getElementById('settings-view').classList.add('hidden');
        document.getElementById('btn-shopping-total').classList.add('hidden'); // Nascondi icona budget
    },
    goHome() { this.hideAllViews(); document.getElementById('home-view').classList.remove('hidden'); this.renderHome(); },
    goRicettario() { this.hideAllViews(); document.getElementById('ricettario-view').classList.remove('hidden'); this.renderRicettario(); },
    goShopping() {
        this.hideAllViews();
        document.getElementById('shopping-view').classList.remove('hidden');
        document.getElementById('btn-shopping-total').classList.remove('hidden'); // MOSTRA icona budget
        this.renderShoppingList();
    },
    showSettings() { this.hideAllViews(); document.getElementById('settings-view').classList.remove('hidden'); },

    async saveData() {
        await idbKeyval.set('timerpro_data', { timers: this.timers, recipes: this.recipes, shoppingList: this.shoppingList, productsDB: this.productsDB });
    },

    // --- MODALI ---
    showModal(id) { document.getElementById(id).classList.remove('hidden'); },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); },

    showAlert(title, message, icon = 'fa-bell', color = 'rose') {
        document.getElementById('alert-title').textContent = title;
        document.getElementById('alert-message').textContent = message;
        const iconContainer = document.getElementById('alert-icon');
        iconContainer.className = `w-16 h-16 rounded-full bg-${color}-100 text-${color}-500 flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm`;
        iconContainer.innerHTML = `<i class="fa-solid ${icon}"></i>`;
        this.showModal('modal-alert');
    },

    showConfirm(title, message, onConfirm) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        const btn = document.getElementById('btn-confirm-yes');
        btn.onclick = () => { onConfirm(); this.closeModal('modal-confirm'); };
        this.showModal('modal-confirm');
    },

    // --- IMMAGINI ---
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            this.tempImageBase64 = event.target.result;
            const preview = document.getElementById('image-preview');
            preview.src = this.tempImageBase64;
            preview.classList.remove('hidden');
            document.getElementById('image-placeholder').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    },

    handleRecipeImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            this.tempRecipeImageBase64 = event.target.result;
            const preview = document.getElementById('edit-recipe-image-preview');
            preview.src = this.tempRecipeImageBase64;
            preview.classList.remove('hidden');
            document.getElementById('edit-recipe-image-placeholder').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    },

    // --- MOTORE TIMER ---
    renderHome() {
        const grid = document.getElementById('timers-grid');
        grid.innerHTML = '';

        this.timers.forEach(timer => {
            const totalSecs = timer.totalMin * 60 + timer.totalSec;
            const formattedTotal = this.formatTime(totalSecs);

            const bgImage = timer.image ? `url(${timer.image})` : 'none';
            const bgClass = timer.image ? 'bg-cover bg-center text-white' : 'bg-white text-slate-800 border-slate-100 border';

            const card = document.createElement('div');
            card.className = `relative p-4 rounded-2xl card-shadow flex flex-col justify-between overflow-hidden group h-40 ${bgClass}`;
            if (timer.image) {
                card.style.backgroundImage = bgImage;
                card.innerHTML = `<div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>`;
            }

            card.innerHTML += `
                <div class="relative z-10 flex-1">
                    <h3 class="font-bold text-lg leading-tight truncate drop-shadow-md ${timer.image ? 'text-white' : ''}">${timer.name}</h3>
                    <p class="text-xs font-bold mt-1 uppercase ${timer.image ? 'text-rose-300 drop-shadow-md' : 'text-slate-400'}">Tot: ${formattedTotal} • ${timer.alarms.length} Fasi</p>
                </div>
                <div class="relative z-10 flex gap-2 mt-auto">
                    <button onclick="app.startTimer('${timer.id}')" class="flex-1 bg-rose-500 text-white py-2 rounded-xl font-bold shadow-md active:scale-95"><i class="fa-solid fa-play"></i></button>
                    <button onclick="app.openTimerForm('${timer.id}')" class="w-10 bg-white/80 backdrop-blur-sm text-slate-700 py-2 rounded-xl active:scale-95 shadow-sm"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="app.askDeleteTimer('${timer.id}')" class="w-10 bg-white/80 backdrop-blur-sm text-slate-700 py-2 rounded-xl active:scale-95 shadow-sm hover:text-red-500"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            grid.appendChild(card);
        });

        const addBtn = document.createElement('button');
        addBtn.onclick = () => this.openTimerForm();
        addBtn.className = "border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-6 text-slate-400 hover:bg-slate-50 hover:border-rose-300 hover:text-rose-500 transition-colors h-40";
        addBtn.innerHTML = `<i class="fa-solid fa-plus text-3xl mb-2"></i><span class="text-xs font-bold uppercase">Manuale</span>`;
        grid.appendChild(addBtn);

        const importBtn = document.createElement('button');
        importBtn.onclick = () => { document.getElementById('recipe-url-input').value = ''; this.showModal('modal-import-link'); };
        importBtn.className = "border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-2xl flex flex-col items-center justify-center p-6 text-blue-400 hover:bg-blue-100 hover:border-blue-300 hover:text-blue-600 transition-colors h-40";
        importBtn.innerHTML = `<i class="fa-solid fa-globe text-3xl mb-2"></i><span class="text-[10px] font-bold uppercase text-center">Importa<br>Ricetta Web</span>`;
        grid.appendChild(importBtn);
    },

    openTimerForm(id = null) {
        this.editingTimerId = id;
        document.getElementById('form-title').textContent = id ? 'Modifica Ricetta' : 'Nuova Ricetta';
        const preview = document.getElementById('image-preview');
        const placeholder = document.getElementById('image-placeholder');
        document.getElementById('timer-image-input').value = '';

        if (id) {
            const t = this.timers.find(x => x.id === id);
            document.getElementById('timer-name').value = t.name;
            document.getElementById('timer-total-min').value = t.totalMin;
            document.getElementById('timer-total-sec').value = t.totalSec;
            this.tempAlarms = JSON.parse(JSON.stringify(t.alarms));
            this.tempImageBase64 = t.image || null;
            if (this.tempImageBase64) {
                preview.src = this.tempImageBase64;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
            } else {
                preview.classList.add('hidden');
                placeholder.classList.remove('hidden');
            }
        } else {
            document.getElementById('timer-name').value = '';
            document.getElementById('timer-total-min').value = '';
            document.getElementById('timer-total-sec').value = '';
            this.tempAlarms = [];
            this.tempImageBase64 = null;
            preview.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }
        this.renderAlarmSteps();
        this.showModal('modal-timer-form');
    },

    renderAlarmSteps() {
        const container = document.getElementById('alarms-container');
        if (this.tempAlarms.length === 0) {
            container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-2">Nessun avviso intermedio inserito.</p>`;
            return;
        }

        this.tempAlarms.sort((a, b) => (b.min * 60 + b.sec) - (a.min * 60 + a.sec));
        container.innerHTML = this.tempAlarms.map((al, idx) => `
            <div class="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <i class="fa-regular fa-bell text-rose-400 pl-1"></i>
                <input type="text" value="${al.name}" onchange="app.updateTempAlarm(${idx}, 'name', this.value)" class="flex-1 bg-transparent border-none text-sm font-bold text-slate-700 outline-none w-20" placeholder="Es. Butta la pasta">
                <div class="flex items-center gap-1 shrink-0 bg-white p-1 rounded-lg border border-slate-200">
                    <span class="text-[10px] text-slate-400 mr-1">-</span>
                    <input type="number" value="${al.min}" onchange="app.updateTempAlarm(${idx}, 'min', this.value)" class="w-8 text-center text-sm font-bold text-slate-700 outline-none" min="0" placeholder="M">
                    <span class="text-xs text-slate-400">:</span>
                    <input type="number" value="${al.sec}" onchange="app.updateTempAlarm(${idx}, 'sec', this.value)" class="w-8 text-center text-sm font-bold text-slate-700 outline-none" min="0" max="59" placeholder="S">
                </div>
                <button onclick="app.removeAlarmStep(${idx})" class="text-slate-400 p-2 hover:text-red-500"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');
    },

    addAlarmStep() {
        this.tempAlarms.push({ name: '', min: 0, sec: 0 });
        this.renderAlarmSteps();
    },

    removeAlarmStep(index) {
        this.tempAlarms.splice(index, 1);
        this.renderAlarmSteps();
    },

    updateTempAlarm(index, field, value) {
        if (field === 'min' || field === 'sec') value = parseInt(value) || 0;
        this.tempAlarms[index][field] = value;
    },

    async saveTimer() {
        const name = document.getElementById('timer-name').value.trim();
        const tMin = parseInt(document.getElementById('timer-total-min').value) || 0;
        const tSec = parseInt(document.getElementById('timer-total-sec').value) || 0;

        if (!name) return this.showAlert('Errore', 'Inserisci il nome della ricetta.');
        if (tMin === 0 && tSec === 0) return this.showAlert('Errore', 'Inserisci il tempo totale.');

        const totalTimerSecs = tMin * 60 + tSec;
        const isAlarmsValid = this.tempAlarms.every(a => {
            const aSecs = a.min * 60 + a.sec;
            return aSecs > 0 && aSecs < totalTimerSecs;
        });

        if (!isAlarmsValid && this.tempAlarms.length > 0) {
            return this.showAlert('Errore Fasi', 'Gli avvisi intermedi devono essere minori del tempo totale e maggiori di zero.');
        }

        const timerObj = {
            id: this.editingTimerId || 'tmr_' + Date.now(),
            name: name,
            image: this.tempImageBase64,
            totalMin: tMin,
            totalSec: tSec,
            alarms: this.tempAlarms
        };

        if (this.editingTimerId) {
            const idx = this.timers.findIndex(t => t.id === this.editingTimerId);
            this.timers[idx] = timerObj;
        } else {
            this.timers.push(timerObj);
        }

        await this.saveData();
        this.renderHome();
        this.closeModal('modal-timer-form');
    },

    askDeleteTimer(id) {
        this.showConfirm('Elimina Ricetta', 'Sei sicuro di voler eliminare questo timer?', async () => {
            this.timers = this.timers.filter(t => t.id !== id);
            await this.saveData();
            this.renderHome();
        });
    },

    startTimer(id) {
        const timer = this.timers.find(t => t.id === id);
        if (!timer) return;

        this.activeTimerData = timer;
        this.totalTimeStart = timer.totalMin * 60 + timer.totalSec;
        this.timeRemaining = this.totalTimeStart;
        this.isPaused = false;

        this.activeTimerData.alarms.forEach(a => a.triggered = false);

        const bgImg = document.getElementById('active-bg-image');
        if (timer.image) {
            bgImg.style.backgroundImage = `url(${timer.image})`;
            bgImg.classList.remove('hidden');
        } else {
            bgImg.classList.add('hidden');
        }

        document.getElementById('active-timer-name').textContent = timer.name;
        document.getElementById('milestone-toast').classList.add('hidden');

        this.showModal('modal-active-timer');
        this.updateTimerUI();

        clearInterval(this.activeTimerInterval);
        this.activeTimerInterval = setInterval(() => this.tick(), 1000);
    },

    tick() {
        if (this.isPaused) return;
        this.timeRemaining--;

        const currentAlarms = this.activeTimerData.alarms.filter(a => !a.triggered && (a.min * 60 + a.sec) === this.timeRemaining);

        if (currentAlarms.length > 0) {
            this.playBeep(false);
            currentAlarms.forEach(a => {
                a.triggered = true;
                this.showMilestoneToast(a.name || 'Avviso Fase!');
            });
        }

        this.updateTimerUI();

        if (this.timeRemaining <= 0) {
            clearInterval(this.activeTimerInterval);
            this.playBeep(true);
            this.showAlert('Tempo Scaduto!', `La preparazione di ${this.activeTimerData.name} è terminata.`, 'fa-bell', 'emerald');
            this.updateTimerUI();
            setTimeout(() => this.stopTimer(), 3000);
        }
    },

    showMilestoneToast(text) {
        const toast = document.getElementById('milestone-toast');
        document.getElementById('milestone-toast-text').textContent = text;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 5000);
    },

    updateTimerUI() {
        const display = document.getElementById('active-time-display');
        display.textContent = this.formatTime(this.timeRemaining);

        let perc = (this.timeRemaining / this.totalTimeStart) * 100;
        if (perc < 0) perc = 0;
        const circle = document.querySelector('.circular-progress');
        circle.style.setProperty('--progress', `${perc}%`);

        const list = document.getElementById('active-alarms-list');
        if (this.activeTimerData.alarms.length === 0) {
            list.innerHTML = `<div class="text-slate-500 text-xs italic">Nessun avviso intermedio.</div>`;
            return;
        }

        const sorted = [...this.activeTimerData.alarms].sort((a, b) => (b.min * 60 + b.sec) - (a.min * 60 + a.sec));
        list.innerHTML = sorted.map(a => {
            const isPassed = a.triggered;
            const timeStr = this.formatTime(a.min * 60 + a.sec);
            return `
                <div class="flex justify-between items-center text-sm ${isPassed ? 'opacity-30 line-through text-slate-400' : 'text-slate-200'}">
                    <span class="truncate pr-2"><i class="fa-solid fa-circle-dot text-[8px] mr-2 ${isPassed ? 'text-slate-500' : 'text-rose-400'}"></i>${a.name || 'Avviso'}</span>
                    <span class="font-mono text-xs font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700 shrink-0">-${timeStr}</span>
                </div>
            `;
        }).join('');
    },

    pauseResumeTimer() {
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('btn-pause');
        btn.innerHTML = this.isPaused ? '<i class="fa-solid fa-play ml-1"></i>' : '<i class="fa-solid fa-pause"></i>';
        btn.classList.toggle('bg-rose-500', this.isPaused);
        btn.classList.toggle('bg-slate-800', !this.isPaused);
    },

    stopTimer() {
        clearInterval(this.activeTimerInterval);
        this.closeModal('modal-active-timer');
    },

    formatTime(totalSeconds) {
        if (totalSeconds < 0) totalSeconds = 0;
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    },

    playBeep(isFinal = false) {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        const playTone = (freq, time, dur) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(1, time + 0.05);
            gain.gain.linearRampToValueAtTime(0, time + dur);
            osc.start(time);
            osc.stop(time + dur);
        };
        const now = this.audioCtx.currentTime;
        if (isFinal) {
            playTone(440, now, 0.2);
            playTone(554, now + 0.2, 0.2);
            playTone(659, now + 0.4, 0.6);
        } else {
            playTone(880, now, 0.15);
            playTone(880, now + 0.2, 0.15);
        }
    },

    // --- IMPOSTAZIONI ---
    exportData() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ timers: this.timers, recipes: this.recipes, shoppingList: this.shoppingList }));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `TimerPro_Backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        this.showAlert('Successo', 'Backup esportato correttamente!', 'fa-check', 'emerald');
    },

    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                // Retrocompatibilità
                if (Array.isArray(imported)) {
                    this.timers = imported;
                } else {
                    this.timers = imported.timers || [];
                    this.recipes = imported.recipes || [];
                    this.shoppingList = imported.shoppingList || [];
                }
                await this.saveData();
                this.goHome();
                this.showAlert('Ripristinato', 'Tutti i dati sono stati caricati con successo.', 'fa-check', 'emerald');
            } catch (err) {
                this.showAlert('Errore File', 'Il file selezionato non è un backup valido.');
            }
        };
        reader.readAsText(file);
    },

    askResetData() {
        this.showConfirm('Reset Dati', 'Attenzione: eliminerai TUTTO. L\'operazione è irreversibile.', async () => {
            this.timers = [];
            this.recipes = [];
            this.shoppingList = [];
            await this.saveData();
            this.goHome();
            this.showAlert('Cancellati', 'Tutti i dati sono stati resettati.', 'fa-trash', 'slate');
        });
    },

    // --- WEB SCRAPER JSON-LD ---
    async fetchRecipeFromUrl() {
        const urlInput = document.getElementById('recipe-url-input').value.trim();
        if (!urlInput) return this.showAlert('Errore', 'Inserisci un link valido.');

        const btn = document.getElementById('btn-fetch-recipe');
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Lettura in corso...`;
        btn.disabled = true;

        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput)}`;
            const response = await fetch(proxyUrl);
            const data = await response.json();

            if (data.contents) {
                this.parseRecipeHTML(data.contents);
            } else {
                throw new Error("Nessun contenuto trovato.");
            }
        } catch (error) {
            console.error(error);
            this.showAlert('Errore Estrazione', 'Impossibile leggere il link. Il sito potrebbe bloccare la lettura o non avere i dati strutturati.', 'fa-triangle-exclamation', 'amber');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    parseRecipeHTML(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, "text/html");
        let recipeData = null;
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

        scripts.forEach(script => {
            try {
                const json = JSON.parse(script.innerHTML);
                const findRecipe = (obj) => {
                    if (!obj) return null;
                    if (obj['@type'] === 'Recipe' || (Array.isArray(obj['@type']) && obj['@type'].includes('Recipe'))) return obj;
                    if (Array.isArray(obj)) {
                        for (let item of obj) {
                            const res = findRecipe(item);
                            if (res) return res;
                        }
                    }
                    if (obj['@graph']) return findRecipe(obj['@graph']);
                    return null;
                };
                const found = findRecipe(json);
                if (found) recipeData = found;
            } catch (e) { }
        });

        if (recipeData) {
            this.displayExtractedRecipe(recipeData);
        } else {
            this.showAlert('Niente Dati Strutturati', 'Il sito non fornisce i dati della ricetta. Prova con GialloZafferano.', 'fa-eye-slash', 'slate');
        }
    },

    parseISODuration(isoString) {
        if (!isoString) return '--';
        const match = isoString.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
        if (!match) return isoString;
        const h = match[1] ? `${match[1]}h ` : '';
        const m = match[2] ? `${match[2]}m` : '';
        return (h + m).trim() || '--';
    },

    // --- GESTIONE RICETTARIO ---
    autoResize(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    },

    async pasteUrl() {
        try {
            const text = await navigator.clipboard.readText();
            document.getElementById('recipe-url-input').value = text;
        } catch (err) {
            this.showAlert('Permesso Negato', 'Non riesco ad accedere agli appunti. Incolla manualmente.');
        }
    },

    renderRicettario() {
        const container = document.getElementById('ricettario-categories');
        container.innerHTML = '';

        const mainCategories = [
            { icon: '🍤', title: 'Antipasti', subs: ['Pizze e focacce', 'Torte salate', 'Insalate'] },
            { icon: '🍝', title: 'Primi Piatti', subs: ['Pasta', 'Pasta al forno', 'Gnocchi', 'Riso'] },
            { icon: '🥩', title: 'Secondi Piatti', subs: ['Carne', 'Pesce', 'Contorni', 'Fritti'] },
            { icon: '🍰', title: 'Dolci & Dessert', subs: ['Biscotti', 'Piccola pasticceria', 'Torte', 'Marmellate'] },
            { icon: '🍽️', title: 'Altro', subs: ['Altro', 'Antipasti', 'Primi', 'Secondi', 'Dolci'] }
        ];

        let hasAnyRecipe = false;

        mainCategories.forEach(mainCat => {
            const catRecipes = this.recipes.filter(r => mainCat.subs.includes(r.category));
            if (catRecipes.length === 0) return;
            hasAnyRecipe = true;

            let html = `
                <div class="mb-6">
                    <h3 class="font-bold text-lg text-slate-700 mb-3 border-b border-slate-200 pb-1">${mainCat.icon} ${mainCat.title}</h3>
                    <div class="grid grid-cols-2 gap-3">
                        ${catRecipes.map(r => {
                const bgClass = r.image ? 'bg-cover bg-center text-white' : 'bg-white text-slate-800 border-slate-100 border';
                const bgStyle = r.image ? `background-image: url(${r.image});` : '';
                return `
                            <div class="relative p-3 rounded-2xl card-shadow flex flex-col justify-between overflow-hidden cursor-pointer active:scale-95 transition-transform h-32 ${bgClass}" style="${bgStyle}" onclick="app.viewRecipe('${r.id}')">
                                ${r.image ? '<div class="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>' : ''}
                                
                                <div class="relative z-10 flex-1 pointer-events-none">
                                    <h4 class="font-bold text-sm leading-tight truncate drop-shadow-md ${r.image ? 'text-white' : ''}">${r.title}</h4>
                                    <p class="text-[9px] mt-1 drop-shadow-md flex items-center gap-1 flex-wrap ${r.image ? 'text-rose-100' : 'text-slate-500'}">
                                        <span class="bg-rose-500 text-white px-1.5 py-0.5 rounded font-bold tracking-widest uppercase text-[8px]">${r.category}</span>
                                        <span class="uppercase"><i class="fa-solid fa-clock"></i> ${r.prepTime || '--'}</span>
                                    </p>
                                </div>
                                
                                <div class="relative z-10 flex gap-1 mt-auto justify-end">
                                    <button onclick="event.stopPropagation(); app.openRecipeEditor('${r.id}')" class="w-8 h-8 bg-white/90 backdrop-blur-sm text-slate-700 rounded-lg shadow-sm flex items-center justify-center hover:text-blue-500"><i class="fa-solid fa-pen text-xs"></i></button>
                                    <button onclick="event.stopPropagation(); app.askDeleteRecipe('${r.id}')" class="w-8 h-8 bg-white/90 backdrop-blur-sm text-slate-700 rounded-lg shadow-sm flex items-center justify-center hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
                                </div>
                            </div>
                            `
            }).join('')}
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });

        if (!hasAnyRecipe) {
            container.innerHTML = `<div class="text-center text-slate-400 py-10 italic">Nessuna ricetta salvata. Usa "Importa Web" o creane una manuale!</div>`;
        }
    },

    viewRecipe(id) {
        const r = this.recipes.find(x => x.id === id);
        if (!r) return;

        this.viewingRecipeId = id;

        const headerImg = document.getElementById('viewer-header-img');
        if (r.image) {
            headerImg.style.backgroundImage = `url(${r.image})`;
            headerImg.classList.remove('hidden');
        } else {
            headerImg.classList.add('hidden');
        }

        document.getElementById('viewer-recipe-title').textContent = r.title;
        document.getElementById('viewer-prep').textContent = r.prepTime || '--';
        document.getElementById('viewer-cook').textContent = r.cookTime || '--';
        document.getElementById('viewer-yield').textContent = r.yield || '--';

        const ingContainer = document.getElementById('viewer-ingredients');
        if (r.ingredients) {
            const ingList = r.ingredients.split('\n').filter(i => i.trim() !== '');
            ingContainer.innerHTML = ingList.map(ing => `<li class="flex gap-2 border-b border-rose-100 pb-1 last:border-0"><i class="fa-solid fa-check text-rose-300 mt-1 shrink-0"></i> <span>${ing}</span></li>`).join('');
        } else {
            ingContainer.innerHTML = `<li class="italic text-slate-400">Ingredienti non specificati.</li>`;
        }

        document.getElementById('viewer-instructions').innerHTML = r.instructions || '<p class="italic text-slate-400">Procedimento non specificato.</p>';
        this.showModal('modal-recipe-viewer');
    },

    displayExtractedRecipe(data) {
        this.closeModal('modal-import-link');

        let imageUrl = null;
        if (data.image) {
            if (Array.isArray(data.image)) imageUrl = typeof data.image[0] === 'string' ? data.image[0] : data.image[0].url;
            else if (typeof data.image === 'string') imageUrl = data.image;
            else if (data.image.url) imageUrl = data.image.url;
        }
        this.tempRecipeImageBase64 = imageUrl;

        document.getElementById('edit-recipe-title').value = data.name || 'Nuova Ricetta';
        document.getElementById('edit-recipe-prep').value = this.parseISODuration(data.prepTime);
        document.getElementById('edit-recipe-cook').value = this.parseISODuration(data.cookTime);

        let yieldText = data.recipeYield || '--';
        if (Array.isArray(yieldText)) yieldText = yieldText[0];
        document.getElementById('edit-recipe-yield').value = yieldText;

        if (data.recipeIngredient && Array.isArray(data.recipeIngredient)) {
            document.getElementById('edit-recipe-ingredients').value = data.recipeIngredient.join('\n');
        }

        if (data.recipeInstructions) {
            let steps = [];
            if (Array.isArray(data.recipeInstructions)) {
                steps = data.recipeInstructions.map(step => (typeof step === 'string' ? step : (step.text || ''))).filter(s => s !== '');
            } else if (typeof data.recipeInstructions === 'string') {
                steps = [data.recipeInstructions];
            }
            document.getElementById('edit-recipe-instructions').value = steps.map(s => s.replace(/(<([^>]+)>)/gi, "")).join('\n\n');
        }

        this.editingRecipeId = null;
        this.openRecipeEditor(null, true);
    },

    openRecipeEditor(id = null, skipClear = false) {
        this.editingRecipeId = id;
        const preview = document.getElementById('edit-recipe-image-preview');
        const placeholder = document.getElementById('edit-recipe-image-placeholder');

        if (id) {
            const r = this.recipes.find(x => x.id === id);
            document.getElementById('edit-recipe-title').value = r.title;
            document.getElementById('edit-recipe-category').value = r.category || 'Pasta';
            document.getElementById('edit-recipe-prep').value = r.prepTime || '';
            document.getElementById('edit-recipe-cook').value = r.cookTime || '';
            document.getElementById('edit-recipe-yield').value = r.yield || '';
            document.getElementById('edit-recipe-ingredients').value = r.ingredients || '';
            document.getElementById('edit-recipe-instructions').value = r.instructions || '';
            this.tempRecipeImageBase64 = r.image || null;
        } else if (!skipClear) {
            document.getElementById('edit-recipe-title').value = '';
            document.getElementById('edit-recipe-prep').value = '';
            document.getElementById('edit-recipe-cook').value = '';
            document.getElementById('edit-recipe-yield').value = '';
            document.getElementById('edit-recipe-ingredients').value = '';
            document.getElementById('edit-recipe-instructions').value = '';
            this.tempRecipeImageBase64 = null;
            document.getElementById('recipe-image-input').value = '';
        }

        if (this.tempRecipeImageBase64) {
            preview.src = this.tempRecipeImageBase64;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            preview.classList.add('hidden');
            placeholder.classList.remove('hidden');
        }

        this.showModal('modal-recipe-editor');
        setTimeout(() => {
            this.autoResize(document.getElementById('edit-recipe-ingredients'));
            this.autoResize(document.getElementById('edit-recipe-instructions'));
        }, 50);
    },

    async saveEditedRecipe() {
        const title = document.getElementById('edit-recipe-title').value.trim();
        if (!title) return this.showAlert('Errore', 'Inserisci un titolo per la ricetta.');

        const recipeObj = {
            id: this.editingRecipeId || 'rec_' + Date.now(),
            title: title,
            image: this.tempRecipeImageBase64,
            category: document.getElementById('edit-recipe-category').value,
            prepTime: document.getElementById('edit-recipe-prep').value,
            cookTime: document.getElementById('edit-recipe-cook').value,
            yield: document.getElementById('edit-recipe-yield').value,
            ingredients: document.getElementById('edit-recipe-ingredients').value,
            instructions: document.getElementById('edit-recipe-instructions').value
        };

        if (this.editingRecipeId) {
            const idx = this.recipes.findIndex(r => r.id === this.editingRecipeId);
            this.recipes[idx] = recipeObj;
        } else {
            this.recipes.push(recipeObj);
        }

        await this.saveData();
        this.closeModal('modal-recipe-editor');
        this.goRicettario();
        this.showAlert('Salvata!', 'La ricetta è stata aggiornata.', 'fa-check', 'emerald');
    },

    askDeleteRecipe(id) {
        this.showConfirm('Elimina Ricetta', 'Sei sicuro di voler eliminare questa ricetta?', async () => {
            this.recipes = this.recipes.filter(r => r.id !== id);
            await this.saveData();
            this.renderRicettario();
        });
    },

    // ==========================================
    // LISTA DELLA SPESA AVANZATA E DATABASE
    // ==========================================
    renderShoppingList() {
        const container = document.getElementById('shopping-list-container');
        container.innerHTML = '';

        if (this.shoppingList.length === 0) {
            container.innerHTML = `<div class="text-center text-slate-400 py-10 italic">La tua lista della spesa è vuota. Usa la barra in alto per cercare o aggiungere prodotti.</div>`;
            return;
        }

        const departments = ['Ortofrutta', 'Carne e Pesce', 'Latticini e Uova', 'Dispensa', 'Surgelati', 'Bevande', 'Cura Casa e Persona', 'Altro'];

        departments.forEach(dept => {
            let items = this.shoppingList.filter(i => i.department === dept);
            if (items.length === 0) return;

            items.sort((a, b) => (a.checked === b.checked) ? 0 : a.checked ? 1 : -1);

            const html = `
                <div class="bg-white rounded-2xl card-shadow border border-slate-100 overflow-hidden">
                    <div class="bg-slate-50 px-4 py-2 border-b border-slate-100 font-bold text-slate-600 text-sm flex items-center justify-between">
                        ${this.getDeptIcon(dept)} ${dept}
                        <span class="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">${items.length}</span>
                    </div>
                    <div class="divide-y divide-slate-100">
                        ${items.map(item => {
                const priceHtml = item.price > 0 ? `<span class="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 rounded ml-2 border border-emerald-100">€${item.price.toFixed(2)}</span>` : '';

                // 1. Badge Quantità spostato a destra
                const qtyBadge = item.qty ? `<span class="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg shrink-0 shadow-sm">${item.qty}</span>` : '';

                // 2. Bottone Icona Foto (invece dell'anteprima)
                const imgBtn = item.image ? `<button onclick="event.stopPropagation(); app.viewShopImage('${item.id}')" class="text-blue-400 hover:text-blue-600 p-2 shrink-0"><i class="fa-solid fa-image"></i></button>` : '';

                return `
                            <div class="p-2 flex items-center justify-between transition-colors ${item.checked ? 'bg-slate-50/50' : ''}">
                                
                                <div class="w-10 h-10 flex items-center justify-center cursor-pointer shrink-0" onclick="app.toggleShoppingItem('${item.id}')">
                                    <div class="w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${item.checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}">
                                        ${item.checked ? '<i class="fa-solid fa-check text-xs"></i>' : ''}
                                    </div>
                                </div>
                                
                                <div class="flex items-center gap-2 flex-1 cursor-pointer py-2 overflow-hidden pl-1" onclick="app.openShoppingEditor('${item.id}')">
                                    <span class="font-medium truncate ${item.checked ? 'line-through text-slate-400' : 'text-slate-800'}">${item.name}</span>
                                    ${priceHtml}
                                </div>
                                
                                <div class="flex items-center gap-1 shrink-0 pl-2">
                                    ${qtyBadge}
                                    ${imgBtn}
                                    <button onclick="app.askDeleteShoppingItem('${item.id}')" class="text-slate-300 hover:text-red-500 p-2 shrink-0"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });
    },

    getDeptIcon(dept) {
        const icons = { 'Ortofrutta': '🍎', 'Carne e Pesce': '🥩', 'Latticini e Uova': '🧀', 'Dispensa': '🍝', 'Surgelati': '❄️', 'Bevande': '🧃', 'Cura Casa e Persona': '🧼', 'Altro': '🛒' };
        return icons[dept] || '🛒';
    },

    // Nuova Funzione: Mostra Immagine a tutto schermo
    viewShopImage(id) {
        const item = this.shoppingList.find(i => i.id === id);
        if (item && item.image) {
            document.getElementById('shop-full-image-display').src = item.image;
            this.showModal('modal-shop-image-viewer');
        }
    },

    // Nuova Funzione: Tasti + e - per la Quantità
    adjustShopQty(delta) {
        const input = document.getElementById('shop-item-qty');
        let val = input.value.trim();

        // Estrae il numero iniziale (es. da "2pz" estrae 2, da "500g" estrae 500)
        let num = parseFloat(val);
        // Prende il testo dopo il numero (es. "pz" o "g")
        let suffix = val.replace(/^[0-9.,]+/, '').trim();

        if (isNaN(num)) {
            num = 0;
            suffix = val; // Se c'era solo testo (es. "un po'"), lo conserva
        }

        num += delta;
        if (num < 0) num = 0;

        // Riassegna mantenendo l'unità di misura se presente
        if (num === 0 && suffix === '') {
            input.value = '';
        } else {
            input.value = suffix ? `${num} ${suffix}` : num;
        }
    },

    async toggleShoppingItem(id) {
        const item = this.shoppingList.find(i => i.id === id);
        if (item) {
            item.checked = !item.checked;
            await this.saveData();
            this.renderShoppingList();
        }
    },

    askDeleteShoppingItem(id) {
        this.showConfirm('Elimina Prodotto', 'Vuoi rimuovere questo ingrediente dalla lista?', async () => {
            this.shoppingList = this.shoppingList.filter(i => i.id !== id);
            await this.saveData();
            this.renderShoppingList();
        });
    },

    askClearShoppingList() {
        if (this.shoppingList.length === 0) return;
        this.showConfirm('Svuota Lista', 'Sei sicuro di voler eliminare TUTTA la lista della spesa?', async () => {
            this.shoppingList = [];
            await this.saveData();
            this.renderShoppingList();
        });
    },

    // --- LOGICA AUTO-COMPLETAMENTO E QUICK ADD ---
    handleQuickAddInput(e) {
        const input = e.target.value.trim().toLowerCase();
        const suggestionsBox = document.getElementById('quick-add-suggestions');

        // Se preme INVIO
        if (e.key === 'Enter') {
            if (input !== '') this.quickAddShoppingItem(e.target.value.trim());
            suggestionsBox.classList.add('hidden');
            return;
        }

        if (input.length < 2) {
            suggestionsBox.classList.add('hidden');
            return;
        }

        // Cerca nel DB locale
        const matches = this.productsDB.filter(p => p.name.toLowerCase().includes(input));

        if (matches.length > 0) {
            suggestionsBox.innerHTML = matches.map(m => `
                <div class="p-3 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50" onclick="app.quickAddFromDB('${m.name}')">
                    <span class="font-bold text-slate-700 text-sm">${m.name}</span>
                    <span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded">${m.department}</span>
                </div>
            `).join('');
            suggestionsBox.classList.remove('hidden');
        } else {
            suggestionsBox.innerHTML = `
                <div class="p-3 text-xs text-slate-500 italic text-center cursor-pointer hover:bg-slate-50" onclick="app.quickAddShoppingItem(document.getElementById('quick-add-input').value)">
                    Tocca qui o premi Invio per aggiungere "${e.target.value}"
                </div>
            `;
            suggestionsBox.classList.remove('hidden');
        }
    },

    quickAddFromDB(name) {
        // 1. Controllo Anti-Duplicato
        if (this.shoppingList.some(i => i.name.toLowerCase() === name.toLowerCase())) {
            this.showAlert('Già presente', `"${name}" è già nella tua lista della spesa!`, 'fa-circle-info', 'blue');
            document.getElementById('quick-add-input').value = '';
            document.getElementById('quick-add-suggestions').classList.add('hidden');
            return;
        }

        const dbItem = this.productsDB.find(p => p.name === name);
        if (dbItem) {
            this.shoppingList.push({
                id: 'shop_' + Date.now(),
                name: dbItem.name,
                department: dbItem.department,
                price: dbItem.price || 0,
                qty: '',
                notes: '',
                image: dbItem.image || null,
                checked: false
            });
            this.finalizeQuickAdd();
        }
    },

    quickAddShoppingItem(name) {
        // 1. Controllo Anti-Duplicato
        if (this.shoppingList.some(i => i.name.toLowerCase() === name.toLowerCase())) {
            this.showAlert('Già presente', `"${name}" è già nella tua lista della spesa!`, 'fa-circle-info', 'blue');
            document.getElementById('quick-add-input').value = '';
            document.getElementById('quick-add-suggestions').classList.add('hidden');
            return;
        }

        this.shoppingList.push({
            id: 'shop_' + Date.now(),
            name: name,
            department: this.guessDepartment(name),
            price: 0,
            qty: '',
            notes: '',
            image: null,
            checked: false
        });
        this.finalizeQuickAdd();
    },

    async finalizeQuickAdd() {
        document.getElementById('quick-add-input').value = '';
        document.getElementById('quick-add-suggestions').classList.add('hidden');
        await this.saveData();
        this.renderShoppingList();
    },

    // --- EDITOR SPESA (MODALE) E FOTO ---
    handleShopImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            this.tempShopImageBase64 = event.target.result;
            document.getElementById('shop-img-preview').src = this.tempShopImageBase64;
            document.getElementById('shop-img-preview').classList.remove('hidden');
            document.getElementById('shop-img-placeholder').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    },

    openShoppingEditor(id) {
        this.editingShopItemId = id;
        const item = this.shoppingList.find(i => i.id === id);
        if (!item) return;

        document.getElementById('shop-item-name').value = item.name;
        document.getElementById('shop-item-qty').value = item.qty || '';
        document.getElementById('shop-item-price').value = item.price || '';
        document.getElementById('shop-item-dept').value = item.department;
        document.getElementById('shop-item-notes').value = item.notes || '';

        this.tempShopImageBase64 = item.image || null;
        if (this.tempShopImageBase64) {
            document.getElementById('shop-img-preview').src = this.tempShopImageBase64;
            document.getElementById('shop-img-preview').classList.remove('hidden');
            document.getElementById('shop-img-placeholder').classList.add('hidden');
        } else {
            document.getElementById('shop-img-preview').classList.add('hidden');
            document.getElementById('shop-img-placeholder').classList.remove('hidden');
        }

        this.showModal('modal-shopping-edit');
    },

    async saveShoppingItem() {
        const id = this.editingShopItemId;
        const name = document.getElementById('shop-item-name').value.trim();
        if (!name) return this.showAlert('Errore', 'Il nome non può essere vuoto.');

        // 1. Controllo Anti-Duplicato (ignora se stesso durante la modifica)
        const isDuplicate = this.shoppingList.some(i => i.id !== id && i.name.toLowerCase() === name.toLowerCase());
        if (isDuplicate) {
            return this.showAlert('Già presente', `Hai già un prodotto chiamato "${name}" nella lista!`, 'fa-triangle-exclamation', 'amber');
        }

        const qty = document.getElementById('shop-item-qty').value.trim();
        const price = parseFloat(document.getElementById('shop-item-price').value) || 0;
        const dept = document.getElementById('shop-item-dept').value;
        const notes = document.getElementById('shop-item-notes').value.trim();

        const itemIndex = this.shoppingList.findIndex(i => i.id === id);
        if (itemIndex > -1) {
            this.shoppingList[itemIndex].name = name;
            this.shoppingList[itemIndex].qty = qty;
            this.shoppingList[itemIndex].price = price;
            this.shoppingList[itemIndex].department = dept;
            this.shoppingList[itemIndex].notes = notes;
            this.shoppingList[itemIndex].image = this.tempShopImageBase64;
        }

        const dbIndex = this.productsDB.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
        const dbPayload = { name: name, department: dept, price: price, image: this.tempShopImageBase64 };

        if (dbIndex > -1) this.productsDB[dbIndex] = dbPayload;
        else this.productsDB.push(dbPayload);

        await this.saveData();
        this.closeModal('modal-shopping-edit');
        this.renderShoppingList();
    },

    // --- CALCOLATORE BUDGET ---
    showShoppingSummary() {
        let inCart = 0;
        let toGet = 0;
        let missingPrices = 0;

        this.shoppingList.forEach(item => {
            const p = parseFloat(item.price) || 0;
            if (p === 0) {
                missingPrices++;
            } else {
                if (item.checked) inCart += p;
                else toGet += p;
            }
        });

        const total = inCart + toGet;

        document.getElementById('sum-incart').textContent = `€ ${inCart.toFixed(2)}`;
        document.getElementById('sum-toget').textContent = `€ ${toGet.toFixed(2)}`;
        document.getElementById('sum-total').textContent = `€ ${total.toFixed(2)}`;

        const missingEl = document.getElementById('sum-missing');
        if (missingPrices > 0) {
            document.getElementById('sum-missing-count').textContent = missingPrices;
            missingEl.classList.remove('hidden');
        } else {
            missingEl.classList.add('hidden');
        }

        this.showModal('modal-shopping-summary');
    },

    // intelligenza Artificiale (come prima)
    guessDepartment(ingredientStr) {
        const str = ingredientStr.toLowerCase();
        if (/mela|pera|banana|frutta|limon|aranc|fragol|pomodor|cipoll|agli|patat|carot|verdura|insalat|zucchine|melanzan|peperon/i.test(str)) return 'Ortofrutta';
        if (/carne|pollo|manzo|maiale|vitello|pesce|tonno|salmone|gamber|salum|prosciut|pancetta|salsiccia/i.test(str)) return 'Carne e Pesce';
        if (/latte|burro|formaggi|uov|uovo|panna|mozzarella|parmigiano|grana|pecorino|mascarpone|ricotta/i.test(str)) return 'Latticini e Uova';
        if (/farina|zucchero|sale|pepe|olio|aceto|pasta|riso|biscotti|pane|lievito|caff|cacao|vaniglia|cioccolato/i.test(str)) return 'Dispensa';
        if (/surgelat|gelato|piselli|spinaci surgelati/i.test(str)) return 'Surgelati';
        if (/acqua|vino|birra|succo|bibita|liquore/i.test(str)) return 'Bevande';
        return 'Altro';
    },

    async importIngredientsToShopping() {
        const recipe = this.recipes.find(r => r.id === this.viewingRecipeId);
        if (!recipe || !recipe.ingredients) return this.showAlert('Attenzione', 'Questa ricetta non ha ingredienti.');

        const items = recipe.ingredients.split('\n').filter(i => i.trim() !== '');

        let addedCount = 0;
        let skippedCount = 0;

        items.forEach(item => {
            const cleanName = item.trim().replace(/^-\s*/, '');

            // 1. Controllo Anti-Duplicato silenzioso per l'importazione multipla
            if (this.shoppingList.some(i => i.name.toLowerCase() === cleanName.toLowerCase())) {
                skippedCount++;
                return; // Salta al prossimo ingrediente
            }

            const dbMatch = this.productsDB.find(p => p.name.toLowerCase() === cleanName.toLowerCase());

            this.shoppingList.push({
                id: 'shop_' + Date.now() + Math.random(),
                name: cleanName,
                department: dbMatch ? dbMatch.department : this.guessDepartment(cleanName),
                price: dbMatch ? dbMatch.price : 0,
                qty: '',
                notes: '',
                image: dbMatch ? dbMatch.image : null,
                checked: false
            });
            addedCount++;
        });

        await this.saveData();

        // Creiamo un messaggio dinamico
        let msg = `Sono stati aggiunti ${addedCount} ingredienti di "${recipe.title}" alla lista della spesa.`;
        if (skippedCount > 0) {
            msg += ` (Altri ${skippedCount} erano già presenti e sono stati saltati).`;
        }

        this.showAlert('Spesa Pronta!', msg, 'fa-cart-shopping', 'emerald');
    },

};

window.onload = () => app.init();