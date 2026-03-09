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
    dataLoaded: false,

    init() {
        console.log("NTC Registro v2.2 - Iniciando...");
        // Desactivada la persistencia por seguridad. Se pedirá PIN cada vez que se abra la app.
        this.isAdmin = false;
        this.bindEvents();
        this.checkAuth();
        this.loadData(); // loadData ahora llamará a checkRoute cuando los datos lleguen
        this.checkRoute(); // Llamar a checkRoute de inmediato
        window.addEventListener('hashchange', () => this.checkRoute());
        lucide.createIcons();
    },

    isAdmin: false,
    MASTER_PIN: "1310",

    checkAuth() {
        if (this.isAdmin) {
            document.body.classList.add('is-admin');
        } else {
            document.body.classList.remove('is-admin');
        }
    },

    login() {
        this.openModal('login');
    },

    verifyPin(pin) {
        if (pin === this.MASTER_PIN) {
            this.isAdmin = true;
            // No guardamos en localStorage para evitar que la sesión sea permanente 
            // y obligar a poner el pin si se refresca la página.
            this.checkAuth();
            this.closeModal();
            this.showToast("Acceso concedido", "success");

            // Refrescar la vista actual para aplicar los cambios de admin
            this.checkRoute();
        } else {
            this.showToast("PIN incorrecto.", "error");
        }
    },

    logout() {
        this.isAdmin = false;
        localStorage.removeItem('ntc_admin'); // Limpiar persistencia
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
                this.data = val;
                if (!this.data.groups) this.data.groups = [];
            } else {
                const saved = localStorage.getItem('ntc_registro_data');
                if (saved) {
                    this.data = JSON.parse(saved);
                    if (!this.data.groups) this.data.groups = [];
                }
            }

            this.dataLoaded = true;
            this.updateStats();

            console.log("Datos cargados de Firebase.");

            // Re-checar la ruta para mostrar al alumno ahora que hay datos
            this.checkRoute();
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
            const students = this.getStudentsArray(g);
            totalStudents += students.length;
        });
        document.getElementById('stat-students').textContent = totalStudents;
    },

    getStudentsArray(group) {
        if (!group || !group.students) return [];
        return Array.isArray(group.students) ? group.students : Object.values(group.students);
    },

    getActivitiesArray(student) {
        if (!student || !student.activities) return [];
        return Array.isArray(student.activities) ? student.activities : Object.values(student.activities);
    },

    getReportsArray(student) {
        if (!student || !student.reports) return [];
        return Array.isArray(student.reports) ? student.reports : Object.values(student.reports);
    },

    bindEvents() {
        const btnAddGroup = document.getElementById('btn-add-group');
        if (btnAddGroup) btnAddGroup.onclick = () => this.openModal('group');

        const btnLogin = document.getElementById('btn-login');
        if (btnLogin) btnLogin.onclick = () => this.login();

        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.onclick = () => this.logout();

        const formActivity = document.getElementById('form-add-activity');
        if (formActivity) formActivity.onsubmit = (e) => this.handleActivitySubmit(e);

        const formReport = document.getElementById('form-add-report');
        if (formReport) formReport.onsubmit = (e) => this.handleReportSubmit(e);

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

    pendingAction: null,

    checkRoute() {
        const hash = window.location.hash;
        console.log("Router: Cambiando a", hash || 'home');

        if (hash.startsWith('#student/')) {
            const parts = hash.split('/');
            const studentId = parts[1];
            const action = parts[2]; // e.g., 'add'
            this.showStudent(studentId, action === 'add');
        } else if (hash.startsWith('#group/')) {
            const groupId = hash.split('/')[1];
            this.isolateGroup(groupId);
        } else {
            this.showAdmin();
        }
    },

    showAdmin() {
        this.currentGroupId = null;
        this.pendingAction = null;
        document.getElementById('view-student').classList.remove('active');
        document.getElementById('view-admin').classList.add('active');
        document.getElementById('group-navigation').style.display = 'none';
        document.body.classList.remove('is-group-isolated');
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
        document.body.classList.add('is-group-isolated');
        this.renderAdmin();
    },

    showStudent(studentId, autoAdd = false) {
        this.currentStudentId = studentId;

        // 1. Cambiar a la vista de alumno inmediatamente
        document.getElementById('view-admin').classList.remove('active');
        document.getElementById('view-student').classList.add('active');

        // 2. Si los datos no han cargado, no podemos hacer más
        if (!this.dataLoaded) {
            console.log("showStudent: Esperando datos...");
            document.getElementById('display-student-name').textContent = "Cargando...";
            if (autoAdd) this.pendingAction = 'add';
            return;
        }

        // 3. Buscar al alumno
        const student = this.findStudent(studentId);
        if (!student) {
            console.error("showStudent: No se encontró al alumno", studentId);
            this.showToast('Alumno no encontrado', 'error');
            return;
        }

        // 4. Renderizar su información
        this.renderStudentView(student);

        // 5. Resetear a la pestaña de actividades por defecto
        this.switchTab('activities');

        // 6. Manejar acción automática (Agregar Actividad)
        if (autoAdd || this.pendingAction === 'add') {
            if (!this.isAdmin) {
                this.pendingAction = 'add';
                this.login();
            } else {
                this.pendingAction = null;
                this.focusActivityForm();
            }
        }
    },

    focusActivityForm() {
        // Pequeño delay para asegurar que el DOM está listo y la animación terminó
        setTimeout(() => {
            const form = document.querySelector('.registration-form');
            const input = document.getElementById('activity-name');
            if (form && input) {
                form.scrollIntoView({ behavior: 'smooth', block: 'center' });
                input.focus();
                // Opcional: vibración ligera para feedback táctil si el navegador lo permite
                if (window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate(50);
                }
            }
        }, 500);
    },

    renderStudentView(student) {
        document.getElementById('view-admin').classList.remove('active');
        document.getElementById('view-student').classList.add('active');

        document.getElementById('display-student-name').textContent = student.name;
        document.getElementById('display-student-group').textContent = student.groupName;

        this.updateActivitySuggestions();
        this.renderStudentActivities(student);
        this.renderStudentReports(student);
        lucide.createIcons(); // Asegurar que los botones de candado se vean
    },

    switchTab(tabName) {
        // Actualizar botones
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('onclick').includes(`'${tabName}'`)) {
                btn.classList.add('active');
            }
        });

        // Actualizar contenido
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`tab-content-${tabName}`).classList.add('active');
    },

    updateActivitySuggestions() {
        const suggestions = new Set();
        this.data.groups.forEach(group => {
            const students = this.getStudentsArray(group);
            students.forEach(student => {
                const activities = this.getActivitiesArray(student);
                activities.forEach(act => {
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
        if (!id) return null;
        const searchId = String(id).trim().replace(/#/g, '');

        for (const group of this.data.groups || []) {
            const students = this.getStudentsArray(group);
            const student = students.find(s => String(s.id).replace(/#/g, '') === searchId);

            if (student) {
                return { ...student, groupName: group.name, groupId: group.id };
            }
        }
        return null;
    },

    getMaxActivitiesForGroup(group) {
        const students = this.getStudentsArray(group);
        if (students.length === 0) return 1;
        const max = Math.max(...students.map(s => this.getActivitiesArray(s).length));
        return max > 0 ? max : 1;
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
            const students = this.getStudentsArray(group);

            return `
            <div class="card">
                <div class="group-header">
                    <div style="display:flex; align-items:center; gap:10px">
                        <h3 class="group-title" style="cursor:pointer" onclick="window.location.hash='#group/${group.id}'">${group.name}</h3>
                        <button class="btn-icon admin-only" onclick="app.openModal('group', '${group.id}', '${group.name}')" title="Editar Grupo">
                            <i data-lucide="edit-2" style="width:14px"></i>
                        </button>
                    </div>
                    <div class="group-actions admin-only">
                        <button class="btn-icon danger" onclick="app.deleteGroup('${group.id}')" title="Eliminar Grupo">
                            <i data-lucide="trash-2"></i>
                        </button>
                        <button class="btn-icon" onclick="app.downloadGroup('${group.id}')" title="Descargar Reporte">
                            <i data-lucide="download"></i>
                        </button>
                        <button class="btn-icon" onclick="app.printGroup('${group.id}')" title="Imprimir Reporte">
                            <i data-lucide="printer"></i>
                        </button>
                        <button class="btn-icon" onclick="app.openModal('student', '${group.id}')" title="Agregar Alumno">
                            <i data-lucide="user-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="students-list">
                    ${students.length === 0 ? '<p class="empty-state">Sin alumnos</p>' :
                    students.map(student => `
                        <div class="student-item">
                            <div class="student-info">
                                <div style="display:flex; align-items:center; gap:8px">
                                    <span class="student-name">${student.name}</span>
                                    ${(this.getReportsArray(student).length > 0) ? `<span class="student-reports-badge">${this.getReportsArray(student).length} Rep.</span>` : ''}
                                    <button class="btn-icon admin-only" onclick="app.openModal('student', '${group.id}', '${student.name}', '${student.id}')" title="Editar Alumno">
                                        <i data-lucide="edit-3" style="width:12px"></i>
                                    </button>
                                </div>
                                <span class="student-meta">${this.getActivitiesArray(student).length} / ${maxActivities} actividades</span>
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
            const students = this.getStudentsArray(group);
            students.forEach(student => {
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
        if (!student) return;
        const list = document.getElementById('activities-list');
        const activities = this.getActivitiesArray(student);
        const count = activities.length;

        const group = this.data.groups.find(g => String(g.id) === String(student.groupId));
        const maxActivities = this.getMaxActivitiesForGroup(group);
        const percent = Math.min((count / maxActivities) * 100, 100);

        document.getElementById('progress-text').textContent = `${count}/${maxActivities}`;
        document.getElementById('progress-bar').style.width = `${percent}%`;

        if (count === 0) {
            list.innerHTML = `<p class="empty-state">No hay actividades registradas.</p>`;
            return;
        }

        list.innerHTML = activities.map(act => `
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
        if (e) e.preventDefault();

        if (!this.isAdmin) {
            this.showToast("Debe iniciar sesión para realizar esta acción.", "error");
            this.login();
            return;
        }

        const nameInput = document.getElementById('activity-name');
        const gradeInput = document.getElementById('activity-grade');
        const name = nameInput.value;
        const grade = gradeInput.value;

        const studentRef = this.findStudent(this.currentStudentId);
        if (!studentRef) {
            this.showToast("No se pudo encontrar el alumno para el registro", "error");
            return;
        }

        const group = this.data.groups.find(g => String(g.id) === String(studentRef.groupId));
        const students = this.getStudentsArray(group);
        const student = students.find(s => String(s.id) === String(studentRef.id));

        if (!student) {
            this.showToast("Error al encontrar datos del alumno", "error");
            return;
        }

        if (!student.activities) student.activities = [];

        // Ensure it's an array before pushing
        let activities = this.getActivitiesArray(student);
        activities.push({
            id: Date.now().toString(),
            name,
            grade,
            date: new Date().toISOString()
        });
        student.activities = activities;

        this.saveData();
        this.updateActivitySuggestions();
        this.renderStudentActivities({ ...student, groupName: group.name, groupId: group.id });
        nameInput.value = '';
        gradeInput.value = '';
    },

    handleReportSubmit(e) {
        if (e) e.preventDefault();
        if (!this.isAdmin) {
            this.showToast("Debe iniciar sesión para realizar esta acción.", "error");
            this.login();
            return;
        }
        const checkboxes = document.querySelectorAll('input[name="report-type"]:checked');
        const reasonInput = document.getElementById('indisciplina-reason');

        if (checkboxes.length === 0) {
            this.showToast("Seleccione al menos un tipo de reporte.", "error");
            return;
        }

        const studentRef = this.findStudent(this.currentStudentId);
        if (!studentRef) return;

        const group = this.data.groups.find(g => String(g.id) === String(studentRef.groupId));
        const students = this.getStudentsArray(group);
        const student = students.find(s => String(s.id) === String(studentRef.id));

        if (!student) return;
        if (!student.reports) student.reports = [];

        // Ensure it's an array before pushing
        let reports = this.getReportsArray(student);

        checkboxes.forEach(cb => {
            let label = "";
            let reason = "";

            switch (cb.value) {
                case 'falta_libro': label = "Falta de libro"; break;
                case 'falta_tarea': label = "Falta de tarea"; break;
                case 'falta_usb': label = "Falta de USB"; break;
                case 'indisciplina':
                    label = "Indisciplina";
                    reason = reasonInput.value.trim();
                    break;
            }

            reports.push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                type: cb.value,
                label: label,
                reason: reason,
                date: new Date().toISOString()
            });
        });

        student.reports = reports;
        this.saveData();
        this.renderStudentReports(student);

        // Reset form
        checkboxes.forEach(cb => cb.checked = false);
        reasonInput.value = '';
        document.getElementById('indisciplina-reason-group').style.display = 'none';

        this.showToast("Reporte(s) guardado(s)", "success");
    },

    renderStudentReports(student) {
        if (!student) return;
        const list = document.getElementById('reports-list');
        const reports = this.getReportsArray(student);
        const count = reports.length;

        document.getElementById('reports-total-text').textContent = `${count} Reportes`;

        if (count === 0) {
            list.innerHTML = `<p class="empty-state">No hay reportes registrados.</p>`;
            return;
        }

        list.innerHTML = reports.map(rep => `
            <div class="report-card">
                <div class="report-info">
                    <span class="report-type">${rep.label}</span>
                    <span class="student-meta">${new Date(rep.date).toLocaleDateString()}</span>
                    ${rep.reason ? `<p class="report-reason">"${rep.reason}"</p>` : ''}
                </div>
                <div class="activity-actions">
                    <button class="btn-icon danger admin-only" onclick="app.deleteReport('${rep.id}')" title="Eliminar">
                        <i data-lucide="trash-2" style="width:16px"></i>
                    </button>
                </div>
            </div>
        `).reverse().join('');
        lucide.createIcons();
    },

    deleteReport(reportId) {
        if (!this.isAdmin) {
            this.showToast("No tiene permisos para eliminar.", "error");
            return;
        }
        if (!confirm('¿Eliminar este reporte?')) return;

        const studentRef = this.findStudent(this.currentStudentId);
        if (!studentRef) return;

        const group = this.data.groups.find(g => String(g.id) === String(studentRef.groupId));
        const students = this.getStudentsArray(group);
        const student = students.find(s => String(s.id) === String(studentRef.id));

        if (student && student.reports) {
            const reportsList = Array.isArray(student.reports) ? student.reports : Object.values(student.reports);
            student.reports = reportsList.filter(r => r.id !== reportId);
            this.saveData();
            this.renderStudentReports(student);
        }
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
        if (!this.isAdmin && this.modalContext?.type !== 'login') {
            this.showToast("Acceso denegado", "error");
            this.closeModal();
            return;
        }
        const ctx = this.modalContext;
        if (!ctx) return this.closeModal();

        console.log("Confirmando modal:", ctx);

        if (ctx.type === 'group') {
            const nameInput = document.getElementById('input-group-name');
            const name = nameInput ? nameInput.value.trim() : '';
            if (!name) {
                this.showToast("Por favor ingrese un nombre para el grupo.", "error");
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
                this.showToast("Por favor ingrese el nombre del alumno.", "error");
                return;
            }

            const group = this.data.groups.find(g => String(g.id) === String(ctx.targetId));
            if (!group) {
                this.showToast("Error: No se encontró el grupo seleccionado.", "error");
                return;
            }

            if (!group.students) group.students = [];

            if (ctx.studentId) {
                const students = this.getStudentsArray(group);
                const student = students.find(s => String(s.id) === String(ctx.studentId));
                if (student) student.name = name;
            } else {
                if (!Array.isArray(group.students)) group.students = this.getStudentsArray(group);
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
        // Obtenemos la URL base sin el hash actual
        const baseUrl = window.location.href.split('#')[0];
        const nfcUrl = `${baseUrl}#student/${studentId}/add`;

        console.log("Copiando link NFC:", nfcUrl);

        navigator.clipboard.writeText(nfcUrl).then(() => {
            this.showToast('¡Link de Registro Rápido copiado!', 'success');
        }).catch(err => {
            console.error('Error al copiar:', err);
            alert('En esta red/navegador no se pudo copiar automáticamente. Copia esto manualmente: ' + nfcUrl);
        });
    },

    deleteGroup(groupId) {
        if (!this.isAdmin) return;
        if (!confirm('¿Seguro que quieres eliminar este grupo y todos sus alumnos?')) return;
        this.data.groups = this.data.groups.filter(g => g.id !== groupId);
        this.saveData();
        this.showAdmin();
    },

    editActivity(activityId) {
        if (!this.isAdmin) {
            this.showToast("No tiene permisos para editar.", "error");
            return;
        }
        const studentRef = this.findStudent(this.currentStudentId);
        if (!studentRef) return;

        const group = this.data.groups.find(g => String(g.id) === String(studentRef.groupId));
        const students = this.getStudentsArray(group);
        const student = students.find(s => String(s.id) === String(studentRef.id));
        const activities = this.getActivitiesArray(student);
        const activity = activities.find(a => a.id === activityId);

        if (!activity) return;

        const newName = prompt('Nombre de la actividad:', activity.name);
        if (newName === null) return;
        const newGrade = prompt('Calificación:', activity.grade);
        if (newGrade === null) return;

        activity.name = newName;
        activity.grade = newGrade;
        this.saveData();
        this.updateActivitySuggestions();
        this.renderStudentActivities({ ...student, groupName: group.name, groupId: group.id });
    },

    deleteActivity(activityId) {
        if (!this.isAdmin) {
            this.showToast("No tiene permisos para eliminar.", "error");
            return;
        }
        if (!confirm('¿Eliminar esta actividad?')) return;
        const studentRef = this.findStudent(this.currentStudentId);
        if (!studentRef) return;

        const group = this.data.groups.find(g => String(g.id) === String(studentRef.groupId));
        const students = this.getStudentsArray(group);
        const student = students.find(s => String(s.id) === String(studentRef.id));

        if (student && student.activities) {
            const activitiesList = Array.isArray(student.activities) ? student.activities : Object.values(student.activities);
            student.activities = activitiesList.filter(a => a.id !== activityId);
            this.saveData();
            this.updateActivitySuggestions();
            this.renderStudentActivities({ ...student, groupName: group.name, groupId: group.id });
        }
    },

    deleteStudent(groupId, studentId) {
        if (!this.isAdmin) return;
        if (!confirm('¿Seguro que quieres eliminar este alumno?')) return;
        const group = this.data.groups.find(g => g.id === groupId);
        group.students = group.students.filter(s => s.id !== studentId);
        this.saveData();
        this.renderAdmin();
    },

    // Printing Logic
    // Reporting Logic (Print & Download)
    printStudent() {
        const student = this.findStudent(this.currentStudentId);
        const html = this.getStudentReportHTML(student);
        this.execPrint(html);
    },

    downloadStudent() {
        const student = this.findStudent(this.currentStudentId);
        const html = this.getStudentReportHTML(student);
        this.execDownload(html, `Reporte_${student.name.replace(/ /g, '_')}.pdf`);
    },

    printGroup(groupId) {
        const group = this.data.groups.find(g => g.id === groupId);
        const html = this.getGroupReportHTML(group);
        this.execPrint(html);
    },

    downloadGroup(groupId) {
        const group = this.data.groups.find(g => g.id === groupId);
        const html = this.getGroupReportHTML(group);
        this.execDownload(html, `Reporte_Grupo_${group.name.replace(/ /g, '_')}.pdf`);
    },

    getStudentReportHTML(student) {
        const activities = this.getActivitiesArray(student);
        const reports = this.getReportsArray(student);

        return `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 800px; margin: auto;">
                <h1 style="color: #6366f1; margin-bottom: 5px;">Historial del Alumno</h1>
                <p style="margin: 2px 0;"><strong>Nombre:</strong> ${student.name}</p>
                <p style="margin: 2px 0;"><strong>Grupo:</strong> ${student.groupName || '-'}</p>
                <p style="margin: 2px 0;"><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p>
                <p style="margin: 2px 0;"><strong>Total Reportes:</strong> ${reports.length}</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                
                <h2 style="font-size: 1.2rem; color: #1e293b; margin-top: 0;">Actividades</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background: #f1f5f9;">
                            <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: left;">Fecha</th>
                            <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: left;">Actividad</th>
                            <th style="border: 1px solid #cbd5e1; padding: 12px; text-align: right;">Calificación</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activities.map(act => `
                            <tr>
                                <td style="border: 1px solid #cbd5e1; padding: 10px;">${new Date(act.date).toLocaleDateString()}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 10px;">${act.name}</td>
                                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold;">${act.grade}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                ${(reports.length > 0) ? `
                <div style="page-break-before: always; height: 1px;"></div>
                <h2 style="font-size: 1.2rem; color: #ef4444; margin-top: 30px;">Historial de Reportes</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background: #fef2f2;">
                            <th style="border: 1px solid #fee2e2; padding: 12px; text-align: left;">Fecha</th>
                            <th style="border: 1px solid #fee2e2; padding: 12px; text-align: left;">Tipo</th>
                            <th style="border: 1px solid #fee2e2; padding: 12px; text-align: left;">Motivo / Comentario</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reports.map(rep => `
                            <tr>
                                <td style="border: 1px solid #fee2e2; padding: 10px;">${new Date(rep.date).toLocaleDateString()}</td>
                                <td style="border: 1px solid #fee2e2; padding: 10px; color: #ef4444; font-weight: bold;">${rep.label}</td>
                                <td style="border: 1px solid #fee2e2; padding: 10px; font-style: italic;">${rep.reason || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}
            </div>
        `;
    },

    getGroupReportHTML(group) {
        const students = this.getStudentsArray(group);
        const maxActs = this.getMaxActivitiesForGroup(group);
        let activityList = [];
        for (let i = 0; i < maxActs; i++) {
            const sample = students.find(s => {
                const acts = this.getActivitiesArray(s);
                return acts[i];
            })?.activities[i];

            if (sample) {
                activityList.push({ num: i + 1, name: sample.name, date: new Date(sample.date).toLocaleDateString() });
            } else {
                activityList.push({ num: i + 1, name: `Actividad ${i + 1}`, date: '-' });
            }
        }

        return `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; width: 100%; box-sizing: border-box;">
                <h1 style="color: #6366f1; margin: 0 0 5px 0; font-size: 1.8rem;">Reporte de Grupo: ${group.name}</h1>
                <p style="color: #64748b; margin-bottom: 25px;">Fecha del reporte: ${new Date().toLocaleDateString()}</p>
                
                <h2 style="font-size: 1.1rem; border-bottom: 2px solid #6366f1; padding-bottom: 5px; color: #1e293b; margin-top: 0;">Cuadro de Calificaciones</h2>
                <div style="overflow-x: auto; margin-bottom: 30px;">
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.75rem;">
                        <thead>
                            <tr style="background: #f8fafc;">
                                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Alumno</th>
                                ${activityList.map(a => `<th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">Act ${a.num}</th>`).join('')}
                                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; background: #e0e7ff; color: #4338ca;">Promedio</th>
                                <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; background: #fee2e2; color: #b91c1c;">Reportes</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${students.map(student => {
            let total = 0;
            const acts = this.getActivitiesArray(student);
            const reports = this.getReportsArray(student);
            const studentGrades = [];

            for (let i = 0; i < maxActs; i++) {
                const gradeValue = acts[i] ? parseFloat(acts[i].grade) : 0;
                studentGrades.push(gradeValue);
                total += gradeValue;
            }
            const avg = maxActs > 0 ? (total / maxActs).toFixed(1) : "0.0";
            const reportCount = reports.length;
            return `
                                    <tr>
                                        <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: 600;">${student.name}</td>
                                        ${studentGrades.map(g => `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: ${g === 0 ? '#94a3b8' : '#1e293b'}">${g}</td>`).join('')}
                                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; background: #f8fafc;">${avg}</td>
                                        <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: ${reportCount > 0 ? '#ef4444' : '#94a3b8'}">${reportCount}</td>
                                    </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="page-break-before: auto; break-inside: avoid;">
                    <h2 style="font-size: 1.1rem; border-bottom: 2px solid #6366f1; padding-bottom: 5px; color: #1e293b; margin-top: 20px;">Lista de Actividades</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.8rem;">
                        <thead>
                            <tr style="background: #f8fafc;">
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
            </div>
        `;
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
    },

    execDownload(html, filename) {
        const element = document.createElement('div');
        element.style.width = '210mm'; // Standard A4 width
        element.style.margin = '0 auto';
        element.innerHTML = html;

        const opt = {
            margin: [10, 5, 10, 5], // Top, Left, Bottom, Right
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false,
                letterRendering: true
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // This ensures the element is rendered properly by html2pdf
        html2pdf().set(opt).from(element).toPdf().get('pdf').then(function (pdf) {
            // Optional: additional pdf manipulation
        }).save();
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'alert-circle';

        toast.innerHTML = `
            <i data-lucide="${icon}" style="width:18px;height:18px"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        lucide.createIcons();

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

window.app = app;
// Expose functions globally to be sure
window.handleModalConfirm = () => app.handleModalConfirm();
window.closeModal = () => app.closeModal();
window.appLogin = () => app.login();
window.appLogout = () => app.logout();

app.init();
