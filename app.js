import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDVVA8TGcU6GZcSlxijaTtwASfdp4t8YO0",
    authDomain: "ntc-registro.firebaseapp.com",
    projectId: "ntc-registro",
    storageBucket: "ntc-registro.firebasestorage.app",
    messagingSenderId: "933069925932",
    appId: "1:933069925932:web:b3bf7fb07892329bb5eb89",
    databaseURL: "https://ntc-registro-default-rtdb.firebaseio.com/"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const app = {
    data: {
        groups: []
    },

    init() {
        this.loadData();
        this.bindEvents();
        this.checkAuth();
        this.checkRoute();
        window.addEventListener('hashchange', () => this.checkRoute());
    },

    isAdmin: false,
    MASTER_PIN: "1310",

    checkAuth() {
        const savedAuth = localStorage.getItem('ntc_admin_auth');
        if (savedAuth === this.MASTER_PIN) {
            this.isAdmin = true;
            document.body.classList.add('is-admin');
        } else {
            this.isAdmin = false;
            document.body.classList.remove('is-admin');
        }
    },

    login() {
        this.openModal('login');
    },

    verifyPin(pin) {
        console.log("Verificando PIN:", pin);
        if (pin === this.MASTER_PIN) {
            localStorage.setItem('ntc_admin_auth', pin);
            this.checkAuth();
            this.renderAdmin();
            if (this.currentStudentId) {
                const student = this.findStudent(this.currentStudentId);
                this.renderStudentActivities(student);
            }
            this.closeModal();
            alert("Acceso concedido");
        } else {
            alert("PIN incorrecto. Intente: 1310");
        }
    },

    logout() {
        localStorage.removeItem('ntc_admin_auth');
        this.checkAuth();
        this.renderAdmin();
        if (this.currentStudentId) {
            const student = this.findStudent(this.currentStudentId);
            this.renderStudentActivities(student);
        }
    },

    loadData() {
        const dataRef = ref(db, 'ntc_data');
        onValue(dataRef, (snapshot) => {
            const val = snapshot.val();
            if (val) {
                // Only re-render if data has actually changed to avoid closing alerts/modals
                const newDataStr = JSON.stringify(val);
                const oldDataStr = JSON.stringify(this.data);

                if (newDataStr !== oldDataStr) {
                    this.data = val;
                    if (!this.data.groups) this.data.groups = [];

                    this.renderAdmin();
                    this.updateStats();

                    if (this.currentStudentId) {
                        const student = this.findStudent(this.currentStudentId);
                        if (student) this.renderStudentActivities(student);
                    }
                }
            } else {
                const saved = localStorage.getItem('ntc_registro_data');
                if (saved) {
                    this.data = JSON.parse(saved);
                    if (!this.data.groups) this.data.groups = [];
                    this.saveData();
                }
            }
        });
    },

    saveData() {
        // Save to Firebase (Realtime)
        set(ref(db, 'ntc_data'), this.data)
            .catch(err => console.error("Error saving to Firebase:", err));

        // Also keep a local backup
        localStorage.setItem('ntc_registro_data', JSON.stringify(this.data));
        this.updateStats();
    },

    updateStats() {
        if (!document.getElementById('stat-groups')) return;
        document.getElementById('stat-groups').textContent = this.data.groups.length;
        let totalStudents = 0;
        this.data.groups.forEach(g => {
            if (g.students) totalStudents += g.students.length;
        });
        document.getElementById('stat-students').textContent = totalStudents;
    },

    bindEvents() {
        document.getElementById('btn-add-group').onclick = () => this.openModal('group');
        document.getElementById('btn-login').onclick = () => this.login();
        document.getElementById('btn-logout').onclick = () => this.logout();
        document.getElementById('form-add-activity').onsubmit = (e) => this.handleActivitySubmit(e);

        // Modal buttons
        const btnConfirm = document.getElementById('modal-confirm');
        if (btnConfirm) btnConfirm.onclick = () => this.handleModalConfirm();

        const btnCancel = document.querySelector('.modal-actions .btn-secondary');
        if (btnCancel) btnCancel.onclick = () => this.closeModal();

        // Close search if clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.getElementById('search-results').style.display = 'none';
            }
        });
    },

    checkRoute() {
        const hash = window.location.hash;
        if (hash.startsWith('#student/')) {
            const studentId = hash.split('/')[1];
            this.showStudent(studentId);
        } else if (hash.startsWith('#group/')) {
            const groupId = hash.split('/')[1];
            this.isolateGroup(groupId);
        } else {
            this.showAdmin();
        }
    },

    showAdmin() {
        this.currentGroupId = null;
        document.getElementById('view-student').classList.remove('active');
        document.getElementById('view-admin').classList.add('active');
        document.getElementById('group-navigation').style.display = 'none';
        document.getElementById('btn-add-group').style.display = 'flex';
        window.location.hash = '';
        this.renderAdmin();
    },

    isolateGroup(groupId) {
        const group = this.data.groups.find(g => g.id === groupId);
        if (!group) {
            this.showAdmin();
            return;
        }
        this.currentGroupId = groupId;
        document.getElementById('view-student').classList.remove('active');
        document.getElementById('view-admin').classList.add('active');
        document.getElementById('group-navigation').style.display = 'flex';
        document.getElementById('current-group-title').textContent = group.name;
        document.getElementById('btn-add-group').style.display = 'none';
        this.renderAdmin();
    },

    showStudent(studentId) {
        const student = this.findStudent(studentId);
        if (!student) {
            alert('Alumno no encontrado');
            this.showAdmin();
            return;
        }

        this.currentStudentId = studentId;
        document.getElementById('view-admin').classList.remove('active');
        document.getElementById('view-student').classList.add('active');

        document.getElementById('display-student-name').textContent = student.name;
        document.getElementById('display-student-group').textContent = student.groupName;

        this.updateActivitySuggestions();
        this.renderStudentActivities(student);
    },

    updateActivitySuggestions() {
        const suggestions = new Set();
        this.data.groups.forEach(group => {
            group.students.forEach(student => {
                student.activities.forEach(act => {
                    suggestions.add(act.name);
                });
            });
        });

        const datalist = document.getElementById('activities-suggestions');
        if (datalist) {
            datalist.innerHTML = Array.from(suggestions).map(name => `<option value="${name}">`).join('');
        }
    },

    findStudent(id) {
        for (const group of this.data.groups) {
            if (!group.students) continue;
            const student = group.students.find(s => s.id === id);
            if (student) return { ...student, groupName: group.name, groupId: group.id };
        }
        return null;
    },

    getMaxActivitiesForGroup(group) {
        if (!group.students || group.students.length === 0) return 1;
        const max = Math.max(...group.students.map(s => (s.activities || []).length));
        return max > 0 ? max : 1; // Default to 1 to avoid division by zero
    },

    renderAdmin() {
        const container = document.getElementById('groups-container');
        let groupsToRender = this.data.groups;

        if (this.currentGroupId) {
            groupsToRender = this.data.groups.filter(g => g.id === this.currentGroupId);
        }

        if (this.data.groups.length === 0) {
            container.innerHTML = `<div class="empty-state"><i data-lucide="users"></i><p>No hay grupos registrados todavía.</p></div>`;
            lucide.createIcons();
            return;
        }

        container.innerHTML = groupsToRender.map(group => {
            const maxActivities = this.getMaxActivitiesForGroup(group);
            return `
            <div class="card">
                <div class="group-header">
                    <div style="display:flex; align-items:center; gap:10px">
                        <h3 class="group-title" style="cursor:pointer" onclick="window.location.hash='#group/${group.id}'">${group.name}</h3>
                        <button class="btn-icon" onclick="app.openModal('group', '${group.id}', '${group.name}')" title="Editar Grupo">
                            <i data-lucide="edit-2" style="width:14px"></i>
                        </button>
                    </div>
                    <div class="group-actions admin-only">
                        <button class="btn-icon danger" onclick="app.deleteGroup('${group.id}')" title="Eliminar Grupo">
                            <i data-lucide="trash-2"></i>
                        </button>
                        <button class="btn-icon" onclick="app.printGroup('${group.id}')" title="Imprimir Grupo">
                            <i data-lucide="printer"></i>
                        </button>
                        <button class="btn-icon" onclick="app.openModal('student', '${group.id}')">
                            <i data-lucide="user-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="students-list">
                    ${(!group.students || group.students.length === 0) ? '<p class="empty-state">Sin alumnos</p>' :
                    group.students.map(student => `
                        <div class="student-item">
                            <div class="student-info">
                                <div style="display:flex; align-items:center; gap:8px">
                                    <span class="student-name">${student.name}</span>
                                    <button class="btn-icon admin-only" onclick="app.openModal('student', '${group.id}', '${student.name}', '${student.id}')" title="Editar Alumno">
                                        <i data-lucide="edit-3" style="width:12px"></i>
                                    </button>
                                </div>
                                <span class="student-meta">${(student.activities || []).length} / ${maxActivities} actividades</span>
                            </div>
                            <div class="student-actions">
                                <button class="btn-icon btn-nfc admin-only" onclick="app.copyNfcLink('${student.id}')" title="Copiar link para NFC">
                                    <i data-lucide="share-2"></i>
                                </button>
                                <button class="btn-icon" onclick="window.location.hash = 'student/${student.id}'">
                                    <i data-lucide="chevron-right"></i>
                                </button>
                                <button class="btn-icon danger admin-only" onclick="app.deleteStudent('${group.id}', '${student.id}')" title="Eliminar Alumno">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `}).join('');
        lucide.createIcons();
        this.updateStats();
    },

    handleSearch(query) {
        const resultsDiv = document.getElementById('search-results');
        if (!query.trim()) {
            resultsDiv.style.display = 'none';
            return;
        }

        const matches = [];
        this.data.groups.forEach(group => {
            if (!group.students) return;
            group.students.forEach(student => {
                if (student.name.toLowerCase().includes(query.toLowerCase())) {
                    matches.push({ ...student, groupName: group.name });
                }
            });
        });

        if (matches.length > 0) {
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = matches.map(m => `
                <div class="search-result-item" onclick="window.location.hash='student/${m.id}'; document.getElementById('input-search-student').value='';">
                    <span class="name">${m.name}</span>
                    <span class="group">${m.groupName}</span>
                </div>
            `).join('');
        } else {
            resultsDiv.style.display = 'block';
            resultsDiv.innerHTML = `<div class="search-result-item"><span class="group">No se encontraron alumnos</span></div>`;
        }
    },

    renderStudentActivities(student) {
        const list = document.getElementById('activities-list');
        const count = (student.activities || []).length;

        const group = this.data.groups.find(g => g.id === student.groupId);
        const maxActivities = this.getMaxActivitiesForGroup(group);
        const percent = Math.min((count / maxActivities) * 100, 100);

        document.getElementById('progress-text').textContent = `${count}/${maxActivities}`;
        document.getElementById('progress-bar').style.width = `${percent}%`;

        if (count === 0) {
            list.innerHTML = `<p class="empty-state">No hay actividades registradas.</p>`;
            return;
        }

        list.innerHTML = (student.activities || []).map(act => `
            <div class="activity-card">
                <div class="activity-info">
                    <p class="activity-name">${act.name}</p>
                    <p class="student-meta">${new Date(act.date).toLocaleDateString()}</p>
                </div>
                <div class="activity-actions">
                    <div class="activity-grade">${act.grade}</div>
                    <button class="btn-icon admin-only" onclick="app.editActivity('${act.id}')" title="Editar">
                        <i data-lucide="edit-2" style="width:16px"></i>
                    </button>
                    <button class="btn-icon danger admin-only" onclick="app.deleteActivity('${act.id}')" title="Eliminar">
                        <i data-lucide="trash-2" style="width:16px"></i>
                    </button>
                </div>
            </div>
        `).reverse().join('');
        lucide.createIcons();
    },

    handleActivitySubmit(e) {
        e.preventDefault();
        const nameInput = document.getElementById('activity-name');
        const gradeInput = document.getElementById('activity-grade');
        const name = nameInput.value;
        const grade = gradeInput.value;

        const group = this.data.groups.find(g => g.students.some(s => s.id === this.currentStudentId));
        const student = group.students.find(s => s.id === this.currentStudentId);
        if (!student.activities) student.activities = [];

        student.activities.push({
            id: Date.now().toString(),
            name,
            grade,
            date: new Date().toISOString()
        });

        this.saveData();
        this.updateActivitySuggestions();
        this.renderStudentActivities({ ...student, groupName: group.name, groupId: group.id });
        nameInput.value = '';
        gradeInput.value = '';
    },

    // Modal Logic
    modalContext: null,
    openModal(type, targetId = null, currentName = '', studentId = null) {
        const overlay = document.getElementById('modal-container');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');

        this.modalContext = { type, targetId, studentId };
        overlay.classList.add('active');

        if (type === 'group') {
            title.textContent = targetId ? 'Editar Grupo' : 'Nuevo Grupo';
            content.innerHTML = `
                <div class="form-group">
                    <label>Nombre del Grupo</label>
                    <input type="text" id="input-group-name" value="${currentName}" placeholder="Ej. 3ro A">
                </div>
            `;
        } else if (type === 'student') {
            title.textContent = studentId ? 'Editar Alumno' : 'Agregar Alumno';
            content.innerHTML = `
                <div class="form-group">
                    <label>Nombre Completo</label>
                    <input type="text" id="input-student-name" value="${currentName}" placeholder="Nombre del alumno">
                </div>
            `;
        } else if (type === 'login') {
            title.textContent = 'Acceso de Maestro';
            content.innerHTML = `
                <div class="form-group">
                    <label>Ingrese el PIN</label>
                    <input type="password" id="input-pin" placeholder="****" inputmode="numeric" pattern="[0-9]*">
                </div>
            `;
        }
    },

    closeModal() {
        document.getElementById('modal-container').classList.remove('active');
    },

    handleModalConfirm() {
        const ctx = this.modalContext;
        if (!ctx) return this.closeModal();

        console.log("Confirmando modal:", ctx);

        if (ctx.type === 'group') {
            const nameInput = document.getElementById('input-group-name');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) {
                alert("Por favor ingrese un nombre para el grupo.");
                return;
            }

            if (ctx.targetId) {
                const group = this.data.groups.find(g => String(g.id) === String(ctx.targetId));
                if (group) group.name = name;
            } else {
                this.data.groups.push({
                    id: Date.now().toString(),
                    name,
                    students: []
                });
            }
        } else if (ctx.type === 'student') {
            const nameInput = document.getElementById('input-student-name');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) {
                alert("Por favor ingrese el nombre del alumno.");
                return;
            }

            const group = this.data.groups.find(g => String(g.id) === String(ctx.targetId));
            if (!group) {
                alert("Error: No se encontró el grupo seleccionado (" + ctx.targetId + ").");
                return;
            }

            if (!group.students) group.students = [];

            if (ctx.studentId) {
                const student = group.students.find(s => String(s.id) === String(ctx.studentId));
                if (student) student.name = name;
            } else {
                group.students.push({
                    id: Math.random().toString(36).substr(2, 9),
                    name: name,
                    activities: []
                });
            }
        } else if (ctx.type === 'login') {
            const pinInput = document.getElementById('input-pin');
            const pin = pinInput ? pinInput.value : '';
            this.verifyPin(pin);
            return;
        }

        this.saveData();
        this.renderAdmin();
        this.closeModal();
    },

    copyNfcLink(studentId) {
        const url = window.location.origin + window.location.pathname + '#student/' + studentId;
        navigator.clipboard.writeText(url).then(() => {
            alert('¡Link copiado! Graba este URL en el tag NFC.');
        });
    },

    deleteGroup(groupId) {
        if (!confirm('¿Seguro que quieres eliminar este grupo y todos sus alumnos?')) return;
        this.data.groups = this.data.groups.filter(g => g.id !== groupId);
        this.saveData();
        this.showAdmin();
    },

    editActivity(activityId) {
        const student = this.findStudent(this.currentStudentId);
        if (!student || !student.activities) return;
        const activity = student.activities.find(a => a.id === activityId);

        const newName = prompt('Nombre de la actividad:', activity.name);
        if (newName === null) return;
        const newGrade = prompt('Calificación:', activity.grade);
        if (newGrade === null) return;

        activity.name = newName;
        activity.grade = newGrade;
        this.saveData();
        this.updateActivitySuggestions();
        this.renderStudentActivities(student);
    },

    deleteActivity(activityId) {
        if (!confirm('¿Eliminar esta actividad?')) return;
        const student = this.findStudent(this.currentStudentId);
        if (!student || !student.activities) return;
        student.activities = student.activities.filter(a => a.id !== activityId);
        this.saveData();
        this.updateActivitySuggestions();
        this.renderStudentActivities(student);
    },

    deleteStudent(groupId, studentId) {
        if (!confirm('¿Seguro que quieres eliminar este alumno?')) return;
        const group = this.data.groups.find(g => g.id === groupId);
        group.students = group.students.filter(s => s.id !== studentId);
        this.saveData();
        this.renderAdmin();
    },

    // Printing Logic
    printStudent() {
        const student = this.findStudent(this.currentStudentId);
        let html = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h1 style="color: #6366f1;">Historial del Alumno</h1>
                <p><strong>Nombre:</strong> ${student.name}</p>
                <p><strong>Grupo:</strong> ${student.groupName}</p>
                <p><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
                <hr>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Fecha</th>
                            <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Actividad</th>
                            <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Calificación</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${student.activities.map(act => `
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 8px;">${new Date(act.date).toLocaleDateString()}</td>
                                <td style="border: 1px solid #ddd; padding: 8px;">${act.name}</td>
                                <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${act.grade}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        this.execPrint(html);
    },

    printGroup(groupId) {
        const group = this.data.groups.find(g => g.id === groupId);
        const maxActs = this.getMaxActivitiesForGroup(group);

        // Generate Activity Reference List
        let activityList = [];
        for (let i = 0; i < maxActs; i++) {
            // Find activity info from any student that has it at this index
            const sample = group.students.find(s => s.activities[i])?.activities[i];
            if (sample) {
                activityList.push({
                    num: i + 1,
                    name: sample.name,
                    date: new Date(sample.date).toLocaleDateString()
                });
            } else {
                activityList.push({ num: i + 1, name: `Actividad ${i + 1}`, date: '-' });
            }
        }

        let html = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h1 style="color: #6366f1; margin: 0 0 5px 0; font-size: 1.8rem;">Reporte de Grupo: ${group.name}</h1>
                <p style="color: #666; margin-bottom: 30px;">Fecha del reporte: ${new Date().toLocaleDateString()}</p>
                
                <h2 style="font-size: 1.1rem; border-bottom: 2px solid #6366f1; padding-bottom: 5px; color: #1e293b; margin-top: 0;">Cuadro de Calificaciones Concentrado</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.75rem;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Nombre del Alumno</th>
                            ${activityList.map(a => `<th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Act ${a.num}</th>`).join('')}
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; background: #e0e7ff; color: #4338ca;">Promedio</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.students.map(student => {
            let total = 0;
            const studentGrades = [];
            for (let i = 0; i < maxActs; i++) {
                const grade = student.activities[i] ? parseFloat(student.activities[i].grade) : 0;
                studentGrades.push(grade);
                total += grade;
            }
            const avg = maxActs > 0 ? (total / maxActs).toFixed(1) : "0.0";

            return `
                                <tr>
                                    <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 600;">${student.name}</td>
                                    ${studentGrades.map(g => `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: ${g === 0 ? '#94a3b8' : '#1e293b'}">${g}</td>`).join('')}
                                    <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; background: #f8fafc;">${avg}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>

                <h2 style="font-size: 1.1rem; border-bottom: 2px solid #6366f1; padding-bottom: 5px; color: #1e293b; margin-top: 40px;">Lista de Actividades</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.8rem;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 50px;">#</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Nombre de la Actividad</th>
                            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activityList.map(a => `
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 600;">${a.num}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px;">${a.name}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 8px; color: #64748b;">${a.date}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        this.execPrint(html);
    },

    execPrint(html) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><head><title>NTC Registro - Reporte</title></head><body>${html}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }
};

window.app = app;
// Expose functions globally to be sure
window.handleModalConfirm = () => app.handleModalConfirm();
window.closeModal = () => app.closeModal();
window.appLogin = () => app.login();
window.appLogout = () => app.logout();

app.init();
