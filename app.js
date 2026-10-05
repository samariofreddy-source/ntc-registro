import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { generateQRCodeDataURL } from "./qr-engine.js?v=3.15";

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
        groups: [],
        collapsedGroups: [] // Store IDs of collapsed groups
    },
    dataLoaded: false,
    selectedMonth: 'all',
    currentSubject: 'tecnologia',
    lastScrollY: 0,
    lastVisitedStudentId: null,

    init() {
        console.log("FreddyApp v3.15 - Iniciando...");
        this.bindEvents();
        this.checkAdminSession(); // Verificar si ya hay una sesión activa
        this.loadData(); // loadData ahora llamará a checkRoute cuando los datos lleguen
        this.checkRoute(); // Llamar a checkRoute de inmediato
        window.addEventListener('hashchange', () => this.checkRoute());
        lucide.createIcons();
    },

    checkAdminSession() {
        const session = localStorage.getItem('ntc_admin_session');
        if (session) {
            const sessionData = JSON.parse(session);
            const now = Date.now();
            const fourHours = 4 * 60 * 60 * 1000;

            if (now - sessionData.timestamp < fourHours) {
                this.isAdmin = true;
                console.log("Sesión de administrador recuperada.");
            } else {
                localStorage.removeItem('ntc_admin_session');
                this.isAdmin = false;
                console.log("Sesión de administrador expirada.");
            }
        } else {
            this.isAdmin = false;
        }
        this.checkAuth();
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
            // Guardamos sesión en localStorage con un timestamp para seguridad (expira en 4h)
            localStorage.setItem('ntc_admin_session', JSON.stringify({
                isAdmin: true,
                timestamp: Date.now()
            }));

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
        localStorage.removeItem('ntc_admin_session'); // Limpiar sesión
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
                this.data = this.normalizeData(val);
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

            // Cargar grupos contraídos del localStorage
            const collapsed = localStorage.getItem('ntc_collapsed_groups');
            if (collapsed) {
                this.data.collapsedGroups = JSON.parse(collapsed);
            } else if (!this.data.collapsedGroups) {
                this.data.collapsedGroups = [];
            }

            console.log("Datos cargados y normalizados.");
            this.checkRoute();
        }, (error) => {
            console.error("Firebase Read Error:", error);
            this.showToast("Error de acceso: Las reglas de Firebase han vencido.", "error");
        });
    },

    normalizeData(data) {
        if (!data || typeof data !== 'object') return data;

        // If it's a group or has specific array-like properties, ensure they are arrays
        if (data.groups) {
            data.groups = Array.isArray(data.groups) ? data.groups : Object.values(data.groups);
            data.groups.forEach(g => {
                if (g.students) {
                    g.students = Array.isArray(g.students) ? g.students : Object.values(g.students);
                    g.students.forEach(s => {
                        if (s.activities) {
                            s.activities = Array.isArray(s.activities) ? s.activities : Object.values(s.activities);
                            s.activities.forEach(act => {
                                if (!act.subject) act.subject = 'tecnologia';
                            });
                        }
                        if (s.exams) {
                            s.exams = Array.isArray(s.exams) ? s.exams : Object.values(s.exams);
                            s.exams.forEach(ex => {
                                if (!ex.subject) ex.subject = 'tecnologia';
                            });
                        } else {
                            s.exams = [];
                        }
                        if (s.reports) {
                            s.reports = Array.isArray(s.reports) ? s.reports : Object.values(s.reports);
                            s.reports.forEach(rep => {
                                if (!rep.subject) rep.subject = 'tecnologia';
                            });
                        }
                    });
                }
            });
        }
        return data;
    },

    saveData() {
        // Save to Firebase (Realtime)
        set(ref(db, 'ntc_data'), this.data)
            .then(() => {
                // Opcional: mostrar éxito al guardar
                // this.showToast("Sincronizado", "success");
            })
            .catch(err => {
                console.error("Error saving to Firebase:", err);
                this.showToast("Error al guardar: Acceso denegado.", "error");
            });

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

    getExamsArray(student) {
        if (!student || !student.exams) return [];
        return Array.isArray(student.exams) ? student.exams : Object.values(student.exams);
    },

    getReportsArray(student) {
        if (!student || !student.reports) return [];
        return Array.isArray(student.reports) ? student.reports : Object.values(student.reports);
    },

    getFilteredActivities(student, subject = this.currentSubject) {
        const acts = this.getActivitiesArray(student);
        return acts.filter(act => act.subject === subject);
    },

    getFilteredExams(student, subject = this.currentSubject) {
        const exams = this.getExamsArray(student);
        return exams.filter(ex => ex.subject === subject);
    },

    getMaxExamsForGroup(group, subject = this.currentSubject) {
        const students = this.getStudentsArray(group);
        if (students.length === 0) return 0;
        const counts = students.map(s => this.getFilteredExams(s, subject).length);
        return Math.max(...counts, 0);
    },

    getFilteredReports(student, subject = this.currentSubject) {
        const reps = this.getReportsArray(student);
        return reps.filter(rep => rep.subject === subject);
    },

    getSubjectLabel(subject = this.currentSubject) {
        if (subject === 'robotica') return 'Robótica';
        if (subject === 'cultura-digital') return 'Cultura Digital';
        return 'Tecnología';
    },

    getSubjectSuffix(subject = this.currentSubject) {
        if (subject === 'robotica') return '_Robotica';
        if (subject === 'cultura-digital') return '_CulturaDigital';
        return '_Tecnologia';
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

        const lateSwitch = document.getElementById('activity-late');
        if (lateSwitch) {
            lateSwitch.onchange = (e) => this.handleLateActivityChange(e.target.checked);
        }

        const formExam = document.getElementById('form-add-exam');
        if (formExam) formExam.onsubmit = (e) => this.handleExamSubmit(e);

        const examLateSwitch = document.getElementById('exam-late');
        if (examLateSwitch) {
            examLateSwitch.onchange = (e) => this.handleLateExamChange(e.target.checked);
        }

        const formReport = document.getElementById('form-add-report');
        if (formReport) formReport.onsubmit = (e) => this.handleReportSubmit(e);

        const gradeInput = document.getElementById('activity-grade');
        if (gradeInput) {
            gradeInput.oninput = () => {
                document.querySelectorAll('#quick-grades .btn-grade').forEach(btn => btn.classList.remove('selected'));
            };
        }

        const examGradeInput = document.getElementById('exam-grade');
        if (examGradeInput) {
            examGradeInput.oninput = () => {
                document.querySelectorAll('#quick-grades-exam .btn-grade').forEach(btn => btn.classList.remove('selected'));
            };
        }

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

        const actSubjectSelect = document.getElementById('activity-subject');
        if (actSubjectSelect) {
            actSubjectSelect.onchange = (e) => this.switchGlobalSubject(e.target.value);
        }

        const examSubjectSelect = document.getElementById('exam-subject');
        if (examSubjectSelect) {
            examSubjectSelect.onchange = (e) => this.switchGlobalSubject(e.target.value);
        }

        const repSubjectSelect = document.getElementById('report-subject');
        if (repSubjectSelect) {
            repSubjectSelect.onchange = (e) => this.switchGlobalSubject(e.target.value);
        }
    },

    switchGlobalSubject(subject) {
        this.currentSubject = subject;
        
        // Sync active class on tabs
        document.querySelectorAll('.subject-tab').forEach(tab => {
            if (tab.id.endsWith(subject)) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Sync form selects if they exist
        const actSubjectSelect = document.getElementById('activity-subject');
        if (actSubjectSelect) actSubjectSelect.value = subject;

        const examSubjectSelect = document.getElementById('exam-subject');
        if (examSubjectSelect) examSubjectSelect.value = subject;

        const repSubjectSelect = document.getElementById('report-subject');
        if (repSubjectSelect) repSubjectSelect.value = subject;

        this.updateActivitySuggestions();
        this.updateExamSuggestions();

        // Refresh views
        if (document.getElementById('view-admin').classList.contains('active')) {
            this.renderAdmin();
        } else if (document.getElementById('view-student').classList.contains('active')) {
            const student = this.findStudent(this.currentStudentId);
            if (student) {
                this.renderStudentView(student);
            }
        }
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
        this.restoreAdminScroll();
    },

    restoreAdminScroll() {
        setTimeout(() => {
            if (this.lastVisitedStudentId) {
                const studentEl = document.querySelector(`[data-student-id="${this.lastVisitedStudentId}"]`);
                if (studentEl) {
                    studentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    studentEl.classList.remove('highlight-student');
                    void studentEl.offsetWidth;
                    studentEl.classList.add('highlight-student');
                    return;
                }
            }
            if (this.lastScrollY) {
                window.scrollTo({ top: this.lastScrollY, behavior: 'smooth' });
            }
        }, 120);
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
        this.restoreAdminScroll();
    },

    showStudent(studentId, autoAdd = false) {
        if (document.getElementById('view-admin').classList.contains('active')) {
            this.lastScrollY = window.scrollY;
        }
        this.lastVisitedStudentId = studentId;

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

    navigateStudent(direction) {
        const studentRef = this.findStudent(this.currentStudentId);
        if (!studentRef) return;

        const group = this.data.groups.find(g => String(g.id) === String(studentRef.groupId));
        if (!group) return;

        const students = this.getStudentsArray(group);
        const currentIndex = students.findIndex(s => String(s.id) === String(studentRef.id));

        if (currentIndex !== -1) {
            const nextIndex = currentIndex + direction;
            if (nextIndex >= 0 && nextIndex < students.length) {
                const nextStudent = students[nextIndex];
                window.location.hash = `student/${nextStudent.id}`;
            } else if (nextIndex < 0) {
                this.showToast("Este es el primer alumno del grupo.", "info");
            } else {
                this.showToast("Este es el último alumno del grupo.", "info");
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

        // Sync active class on subject tabs
        document.querySelectorAll('.subject-tab').forEach(tab => {
            if (tab.id.endsWith(this.currentSubject)) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Sync form selects if they exist
        const actSubjectSelect = document.getElementById('activity-subject');
        if (actSubjectSelect) actSubjectSelect.value = this.currentSubject;

        const examSubjectSelect = document.getElementById('exam-subject');
        if (examSubjectSelect) examSubjectSelect.value = this.currentSubject;

        const repSubjectSelect = document.getElementById('report-subject');
        if (repSubjectSelect) repSubjectSelect.value = this.currentSubject;

        // Auto-completar nombre de actividad si ya se registró una hoy para este grupo
        const nameInput = document.getElementById('activity-name');
        if (nameInput) {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const lastActivity = localStorage.getItem(`ntc_last_act_${student.groupId}_${today}`);
            nameInput.value = lastActivity || '';
        }

        // Auto-completar nombre de examen si ya se registró uno hoy para este grupo
        const examNameInput = document.getElementById('exam-name');
        if (examNameInput) {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const lastExam = localStorage.getItem(`ntc_last_exam_${student.groupId}_${today}`);
            examNameInput.value = lastExam || '';
        }

        this.updateActivitySuggestions();
        this.updateExamSuggestions();
        this.updateMonthSelector(student);
        this.renderStudentActivities(student);
        this.renderStudentExams(student);
        this.renderStudentReports(student);
        lucide.createIcons(); // Asegurar que los botones de candado se vean
    },

    updateMonthSelector(student) {
        const selector = document.getElementById('select-month');
        if (!selector) return;

        const months = new Set();
        
        // Buscar meses de actividades y exámenes de todos los alumnos del grupo
        const group = this.data.groups.find(g => String(g.id) === String(student.groupId));
        if (group) {
            const students = this.getStudentsArray(group);
            students.forEach(s => {
                this.getFilteredActivities(s, this.currentSubject).forEach(act => {
                    if (act.date) {
                        const d = new Date(act.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        months.add(monthKey);
                    }
                });
                this.getFilteredExams(s, this.currentSubject).forEach(ex => {
                    if (ex.date) {
                        const d = new Date(ex.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        months.add(monthKey);
                    }
                });
            });
        }

        const sortedMonths = Array.from(months).sort().reverse();
        
        let html = '<option value="all">Todos los meses</option>';
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        sortedMonths.forEach(m => {
            const [year, month] = m.split('-');
            const name = `${monthNames[parseInt(month) - 1]} ${year}`;
            html += `<option value="${m}" ${this.selectedMonth === m ? 'selected' : ''}>${name}</option>`;
        });

        selector.innerHTML = html;
    },

    handleMonthChange(month) {
        this.selectedMonth = month;
        const student = this.findStudent(this.currentStudentId);
        if (student) {
            this.renderStudentActivities(student);
            this.renderStudentExams(student);
        }
    },

    handleLateActivityChange(checked) {
        const container = document.getElementById('activity-date-container');
        const dateInput = document.getElementById('activity-date');
        if (container && dateInput) {
            if (checked) {
                container.style.display = 'block';
                // Calcular el último día del mes anterior
                const now = new Date();
                const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                const year = lastDayPrevMonth.getFullYear();
                const month = String(lastDayPrevMonth.getMonth() + 1).padStart(2, '0');
                const day = String(lastDayPrevMonth.getDate()).padStart(2, '0');
                dateInput.value = `${year}-${month}-${day}`;
            } else {
                container.style.display = 'none';
                dateInput.value = '';
            }
        }
    },

    handleLateExamChange(checked) {
        const container = document.getElementById('exam-date-container');
        const dateInput = document.getElementById('exam-date');
        if (container && dateInput) {
            if (checked) {
                container.style.display = 'block';
                const now = new Date();
                const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                const year = lastDayPrevMonth.getFullYear();
                const month = String(lastDayPrevMonth.getMonth() + 1).padStart(2, '0');
                const day = String(lastDayPrevMonth.getDate()).padStart(2, '0');
                dateInput.value = `${year}-${month}-${day}`;
            } else {
                container.style.display = 'none';
                dateInput.value = '';
            }
        }
    },

    prepareDeliverActivity(actName) {
        if (!this.isAdmin) {
            this.showToast("Debe iniciar sesión para registrar entregas.", "error");
            this.login();
            return;
        }

        const nameInput = document.getElementById('activity-name');
        const subjectSelect = document.getElementById('activity-subject');
        const gradeInput = document.getElementById('activity-grade');
        const form = document.querySelector('.registration-form');

        if (nameInput) nameInput.value = actName;
        if (subjectSelect) subjectSelect.value = this.currentSubject;

        // Reset grade selection
        if (gradeInput) gradeInput.value = '';
        document.querySelectorAll('.btn-grade').forEach(btn => btn.classList.remove('selected'));

        // Scroll into view & animate form
        if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
            form.classList.remove('highlight-form');
            void form.offsetWidth;
            form.classList.add('highlight-form');
        }

        this.showToast(`Entregando "${actName}". Seleccione la calificación.`, "info");
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
        const activeSubject = document.getElementById('activity-subject')?.value || this.currentSubject;
        this.data.groups.forEach(group => {
            const students = this.getStudentsArray(group);
            students.forEach(student => {
                const activities = this.getFilteredActivities(student, activeSubject);
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

    updateExamSuggestions() {
        const suggestions = new Set();
        const activeSubject = document.getElementById('exam-subject')?.value || this.currentSubject;
        this.data.groups.forEach(group => {
            const students = this.getStudentsArray(group);
            students.forEach(student => {
                const exams = this.getFilteredExams(student, activeSubject);
                exams.forEach(ex => {
                    if (ex.name) suggestions.add(ex.name);
                });
            });
        });

        const datalist = document.getElementById('exams-suggestions');
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

    getMaxActivitiesForGroup(group, subject = this.currentSubject) {
        const students = this.getStudentsArray(group);
        if (students.length === 0) return 1;
        const max = Math.max(...students.map(s => this.getFilteredActivities(s, subject).length));
        return max > 0 ? max : 1;
    },

    renderAdmin() {
        const container = document.getElementById('groups-container');
        let groupsToRender = this.data.groups;

        // Sync active class on subject tabs
        document.querySelectorAll('.subject-tab').forEach(tab => {
            if (tab.id.endsWith(this.currentSubject)) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        if (this.currentGroupId) {
            groupsToRender = this.data.groups.filter(g => g.id === this.currentGroupId);
        }

        if (this.data.groups.length === 0) {
            container.innerHTML = `<div class="empty-state"><i data-lucide="users"></i><p>No hay grupos registrados todavía.</p></div>`;
            lucide.createIcons();
            return;
        }

        container.innerHTML = groupsToRender.map(group => {
            const maxActivities = this.getMaxActivitiesForGroup(group, this.currentSubject);
            const students = this.getStudentsArray(group);

            return `
            <div class="card group-card" data-group-id="${group.id}">
                <div class="group-header">
                    <div style="display:flex; align-items:center; gap:10px">
                        <div class="drag-handle admin-only" title="Arrastrar para reordenar">
                            <i data-lucide="grip-vertical"></i>
                        </div>
                        <button class="btn-icon btn-toggle-group ${this.data.collapsedGroups.includes(group.id) ? 'collapsed' : ''}" 
                                onclick="app.toggleGroup('${group.id}')" title="Contraer/Expandir">
                            <i data-lucide="chevron-down"></i>
                        </button>
                        <h3 class="group-title" style="cursor:pointer" onclick="window.location.hash='#group/${group.id}'">${group.name}</h3>
                        <button class="btn-icon admin-only" onclick="app.openModal('group', '${group.id}', '${group.name}')" title="Editar Grupo">
                            <i data-lucide="edit-2" style="width:14px"></i>
                        </button>
                    </div>
                    <div class="group-actions admin-only">
                        <button class="btn-icon danger" onclick="app.deleteGroup('${group.id}')" title="Eliminar Grupo">
                            <i data-lucide="trash-2"></i>
                        </button>
                        <button class="btn-icon" onclick="app.downloadGroupOptions('${group.id}', '${group.name}')" title="Descargar Reporte">
                            <i data-lucide="download"></i>
                        </button>
                        <button class="btn-icon" onclick="app.printGroup('${group.id}')" title="Imprimir Reporte">
                            <i data-lucide="printer"></i>
                        </button>
                        <button class="btn-icon admin-only" onclick="app.openModal('import-students', '${group.id}', '${group.name}')" title="Importar Alumnos (Excel, PDF o Foto)">
                            <i data-lucide="file-up"></i>
                        </button>
                        <button class="btn-icon" onclick="app.openModal('student', '${group.id}')" title="Agregar Alumno">
                            <i data-lucide="user-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="students-list ${this.data.collapsedGroups.includes(group.id) ? 'collapsed' : ''}">
                    ${students.length === 0 ? '<p class="empty-state">Sin alumnos</p>' :
                    students.map(student => {
                        const filteredActivities = this.getFilteredActivities(student, this.currentSubject);
                        const filteredExams = this.getFilteredExams(student, this.currentSubject);
                        const filteredReports = this.getFilteredReports(student, this.currentSubject);
                        return `
                        <div class="student-item" data-student-id="${student.id}">
                            <div class="student-info">
                                <div style="display:flex; align-items:center; gap:8px">
                                    <span class="student-name">${student.name}</span>
                                    ${(filteredExams.length > 0) ? `<span class="student-exams-badge">${filteredExams.length} Ex.</span>` : ''}
                                    ${(filteredReports.length > 0) ? `<span class="student-reports-badge">${filteredReports.length} Rep.</span>` : ''}
                                    <button class="btn-icon admin-only" onclick="app.openModal('student', '${group.id}', '${student.name}', '${student.id}')" title="Editar Alumno">
                                        <i data-lucide="edit-3" style="width:12px"></i>
                                    </button>
                                </div>
                                <span class="student-meta">${filteredActivities.length} / ${maxActivities} actividades${filteredExams.length > 0 ? ` • ${filteredExams.length} examen${filteredExams.length > 1 ? 'es' : ''}` : ''}</span>
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
                        `;
                    }).join('')}
                </div>
            </div>
        `}).join('');

        // Actualizar botones de control global
        const btnCollapse = document.getElementById('btn-collapse-all');
        const btnExpand = document.getElementById('btn-expand-all');
        const groupsControls = document.getElementById('groups-controls');

        if (this.currentGroupId) {
            if (groupsControls) groupsControls.style.display = 'none';
        } else if (this.data.groups.length > 0) {
            if (groupsControls) groupsControls.style.display = 'flex';
            if (this.data.collapsedGroups.length >= this.data.groups.length) {
                if (btnCollapse) btnCollapse.style.display = 'none';
                if (btnExpand) btnExpand.style.display = 'flex';
            } else {
                if (btnCollapse) btnCollapse.style.display = 'flex';
                if (btnExpand) btnExpand.style.display = 'none';
            }
        } else {
            if (groupsControls) groupsControls.style.display = 'none';
        }

        lucide.createIcons();
        this.updateStats();
        this.setupGroupDragAndDrop();
    },

    setupGroupDragAndDrop() {
        if (this.currentGroupId || !this.isAdmin) return;
        const container = document.getElementById('groups-container');
        if (!container) return;

        const cards = Array.from(container.querySelectorAll('.group-card'));
        if (cards.length === 0) return;

        let draggedCard = null;

        cards.forEach(card => {
            const handle = card.querySelector('.drag-handle');
            if (handle) {
                handle.setAttribute('draggable', 'true');
            }
            card.setAttribute('draggable', 'true');

            card.addEventListener('dragstart', (e) => {
                const target = e.target;
                if (target.closest('button') || target.closest('input') || target.closest('.student-item')) {
                    if (!target.closest('.drag-handle')) {
                        e.preventDefault();
                        return;
                    }
                }
                draggedCard = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.dataset.groupId);
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                cards.forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
                draggedCard = null;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedCard || draggedCard === card) return;

                e.dataTransfer.dropEffect = 'move';

                const rect = card.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const halfHeight = rect.height / 2;

                cards.forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));

                if (offsetY < halfHeight) {
                    card.classList.add('drag-over-top');
                } else {
                    card.classList.add('drag-over-bottom');
                }
            });

            card.addEventListener('dragleave', (e) => {
                if (!card.contains(e.relatedTarget)) {
                    card.classList.remove('drag-over-top', 'drag-over-bottom');
                }
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();

                cards.forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));

                if (!draggedCard || draggedCard === card) return;

                const draggedId = draggedCard.dataset.groupId;
                const targetId = card.dataset.groupId;

                const rect = card.getBoundingClientRect();
                const offsetY = e.clientY - rect.top;
                const position = (offsetY < rect.height / 2) ? 'before' : 'after';

                this.reorderGroups(draggedId, targetId, position);
            });

            if (handle) {
                handle.addEventListener('touchstart', (e) => {
                    draggedCard = card;
                    card.classList.add('dragging');
                }, { passive: true });

                handle.addEventListener('touchmove', (e) => {
                    if (!draggedCard) return;
                    const touch = e.touches[0];
                    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (!targetElement) return;

                    const hoverCard = targetElement.closest('.group-card');
                    cards.forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));

                    if (hoverCard && hoverCard !== draggedCard) {
                        const rect = hoverCard.getBoundingClientRect();
                        const offsetY = touch.clientY - rect.top;
                        if (offsetY < rect.height / 2) {
                            hoverCard.classList.add('drag-over-top');
                        } else {
                            hoverCard.classList.add('drag-over-bottom');
                        }
                    }
                }, { passive: true });

                handle.addEventListener('touchend', (e) => {
                    if (!draggedCard) return;
                    card.classList.remove('dragging');
                    const touch = e.changedTouches[0];
                    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);

                    if (targetElement) {
                        const dropCard = targetElement.closest('.group-card');
                        if (dropCard && dropCard !== draggedCard) {
                            const rect = dropCard.getBoundingClientRect();
                            const offsetY = touch.clientY - rect.top;
                            const position = (offsetY < rect.height / 2) ? 'before' : 'after';

                            const draggedId = draggedCard.dataset.groupId;
                            const targetId = dropCard.dataset.groupId;

                            this.reorderGroups(draggedId, targetId, position);
                        }
                    }

                    cards.forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom'));
                    draggedCard = null;
                });
            }
        });
    },

    reorderGroups(draggedId, targetId, position) {
        if (!this.data.groups || this.data.groups.length <= 1) return;

        const draggedIndex = this.data.groups.findIndex(g => g.id === draggedId);
        const targetIndex = this.data.groups.findIndex(g => g.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        const [draggedGroup] = this.data.groups.splice(draggedIndex, 1);

        let insertIndex = this.data.groups.findIndex(g => g.id === targetId);
        if (position === 'after') {
            insertIndex += 1;
        }

        this.data.groups.splice(insertIndex, 0, draggedGroup);

        this.saveData();
        this.renderAdmin();
        this.showToast("Orden de grupos actualizado", "success");
    },

    toggleGroup(groupId) {
        if (!this.data.collapsedGroups) this.data.collapsedGroups = [];

        const index = this.data.collapsedGroups.indexOf(groupId);
        if (index === -1) {
            this.data.collapsedGroups.push(groupId);
        } else {
            this.data.collapsedGroups.splice(index, 1);
        }

        // No guardamos esto en Firebase para que sea un estado local de la sesión
        // pero sí lo guardamos en localStorage para persistencia del usuario actual
        localStorage.setItem('ntc_collapsed_groups', JSON.stringify(this.data.collapsedGroups));
        this.renderAdmin();
    },

    toggleAllGroups(collapse) {
        if (collapse) {
            this.data.collapsedGroups = this.data.groups.map(g => g.id);
        } else {
            this.data.collapsedGroups = [];
        }
        localStorage.setItem('ntc_collapsed_groups', JSON.stringify(this.data.collapsedGroups));
        this.renderAdmin();
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
        let activities = this.getFilteredActivities(student, this.currentSubject);
        
        const group = this.data.groups.find(g => String(g.id) === String(student.groupId));
        let maxActivities = 0;

        if (this.selectedMonth !== 'all') {
            activities = activities.filter(act => {
                const d = new Date(act.date);
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return monthKey === this.selectedMonth;
            });

            // Calcular el máximo de actividades en ESTE mes para el grupo
            if (group) {
                const students = this.getStudentsArray(group);
                students.forEach(s => {
                    const sActs = this.getFilteredActivities(s, this.currentSubject).filter(act => {
                        const d = new Date(act.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === this.selectedMonth;
                    });
                    if (sActs.length > maxActivities) maxActivities = sActs.length;
                });
            }
        } else {
            maxActivities = this.getMaxActivitiesForGroup(group, this.currentSubject);
        }

        if (maxActivities === 0) maxActivities = 1;
        const count = activities.length;
        const percent = Math.min((count / maxActivities) * 100, 100);

        document.getElementById('progress-text').textContent = `${count}/${maxActivities}`;
        document.getElementById('progress-bar').style.width = `${percent}%`;

        if (count === 0) {
            list.innerHTML = `<p class="empty-state">No hay actividades registradas.</p>`;
        } else {
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
        }

        // Renderizar Actividades Faltantes
        const missingContainer = document.getElementById('missing-activities-container');
        if (missingContainer && group) {
            const groupStudents = this.getStudentsArray(group);
            const allGroupActivities = new Set();
            
            groupStudents.forEach(s => {
                let sActs = this.getFilteredActivities(s, this.currentSubject);
                if (this.selectedMonth !== 'all') {
                    sActs = sActs.filter(act => {
                        const d = new Date(act.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === this.selectedMonth;
                    });
                }
                sActs.forEach(act => {
                    if (act.name && act.name.trim()) {
                        allGroupActivities.add(act.name.trim());
                    }
                });
            });

            const studentActNames = new Set(activities.map(act => act.name ? act.name.trim() : ''));
            const missingActivities = Array.from(allGroupActivities).filter(actName => !studentActNames.has(actName));

            if (missingActivities.length > 0) {
                missingContainer.innerHTML = `
                    <div class="missing-activities-card">
                        <div class="summary-header">
                            <h4 style="display:flex; align-items:center; gap:8px; color: #f59e0b; font-size: 1rem;">
                                <i data-lucide="alert-circle" style="color: #f59e0b; width: 18px; height: 18px;"></i>
                                Actividades Faltantes (${missingActivities.length})
                            </h4>
                        </div>
                        <p class="student-meta" style="margin-top: 4px; font-size: 0.8rem;">Haga clic en "Entregar" para calificar una tarea pendiente:</p>
                        <div class="missing-activities-list">
                            ${missingActivities.map(actName => `
                                <div class="missing-activity-item" onclick="app.prepareDeliverActivity('${actName.replace(/'/g, "\\'")}')" title="Entregar esta actividad">
                                    <span class="missing-tag">
                                        <i data-lucide="clock" style="width: 14px; height: 14px;"></i>
                                        ${actName}
                                    </span>
                                    <button class="btn-deliver-small admin-only" type="button">
                                        <i data-lucide="plus-circle" style="width: 14px; height: 14px;"></i> Entregar
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            } else {
                missingContainer.innerHTML = `
                    <div class="up-to-date-card">
                        <i data-lucide="check-circle-2" style="width: 20px; height: 20px;"></i>
                        <span>¡Al día! No tiene actividades pendientes en esta materia.</span>
                    </div>
                `;
            }
        }

        // Renderizar Resumen de Reportes
        const reportsSummaryContainer = document.getElementById('student-reports-summary-container');
        if (reportsSummaryContainer) {
            const reports = this.getFilteredReports(student, this.currentSubject);
            if (reports.length > 0) {
                reportsSummaryContainer.innerHTML = `
                    <div class="student-reports-card">
                        <div class="summary-header" style="margin-bottom: 12px;">
                            <h4 style="display:flex; align-items:center; gap:8px; color: var(--danger); font-size: 1rem;">
                                <i data-lucide="alert-triangle" style="color: var(--danger); width: 18px; height: 18px;"></i>
                                Reportes Registrados (${reports.length})
                            </h4>
                        </div>
                        <div class="reports-summary-list">
                            ${reports.map(rep => `
                                <div class="report-card" style="margin-bottom: 8px;">
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
                            `).reverse().join('')}
                        </div>
                    </div>
                `;
            } else {
                reportsSummaryContainer.innerHTML = `
                    <div class="no-reports-card">
                        <i data-lucide="shield-check" style="width: 20px; height: 20px; color: var(--success);"></i>
                        <span>Sin reportes registrados en esta materia.</span>
                    </div>
                `;
            }
        }

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
        const subjectSelect = document.getElementById('activity-subject');
        const name = nameInput.value;
        const grade = gradeInput.value;
        const subject = subjectSelect ? subjectSelect.value : 'tecnologia';

        // Manejo de fecha retroactiva (actividad atrasada)
        const lateSwitch = document.getElementById('activity-late');
        const dateInput = document.getElementById('activity-date');
        let activityDate = new Date();

        if (lateSwitch && lateSwitch.checked && dateInput && dateInput.value) {
            const [year, month, day] = dateInput.value.split('-');
            // Creamos la fecha a las 12:00 para evitar desajustes de zona horaria al convertir a ISO
            activityDate = new Date(year, month - 1, day, 12, 0, 0);
        }

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
            subject,
            date: activityDate.toISOString()
        });
        student.activities = activities;

        this.saveData();
        this.updateActivitySuggestions();

        // Guardar nombre de actividad para auto-completar en el mismo grupo y día
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        localStorage.setItem(`ntc_last_act_${group.id}_${today}`, name);

        this.renderStudentActivities({ ...student, groupName: group.name, groupId: group.id });
        
        // Al limpiar, si tenemos el nombre guardado para hoy/grupo, lo volvemos a poner
        // (esto ayuda si se registra otra actividad para el mismo alumno)
        nameInput.value = localStorage.getItem(`ntc_last_act_${group.id}_${today}`) || '';
        gradeInput.value = '';
        if (subjectSelect) subjectSelect.value = this.currentSubject;

        // Restablecer el interruptor y ocultar la fecha retroactiva
        if (lateSwitch) {
            lateSwitch.checked = false;
            this.handleLateActivityChange(false);
        }

        // Limpiar selección de botones rápidos
        document.querySelectorAll('.btn-grade').forEach(btn => btn.classList.remove('selected'));
    },

    setGrade(grade) {
        const input = document.getElementById('activity-grade');
        if (input) {
            input.value = grade;

            // Visual feedback for selected button
            document.querySelectorAll('.btn-grade').forEach(btn => {
                btn.classList.remove('selected');
                if (parseInt(btn.textContent) === grade) {
                    btn.classList.add('selected');
                }
            });

            // Feedback táctil si es posible
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(20);
            }
        }
    },

    setExamGrade(grade) {
        const input = document.getElementById('exam-grade');
        if (input) {
            input.value = grade;

            document.querySelectorAll('#quick-grades-exam .btn-grade').forEach(btn => {
                btn.classList.remove('selected');
                if (parseInt(btn.textContent) === grade) {
                    btn.classList.add('selected');
                }
            });

            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(20);
            }
        }
    },

    handleExamSubmit(e) {
        if (e) e.preventDefault();

        if (!this.isAdmin) {
            this.showToast("Debe iniciar sesión para realizar esta acción.", "error");
            this.login();
            return;
        }

        const nameInput = document.getElementById('exam-name');
        const gradeInput = document.getElementById('exam-grade');
        const subjectSelect = document.getElementById('exam-subject');
        const name = nameInput.value.trim();
        const grade = gradeInput.value;
        const subject = subjectSelect ? subjectSelect.value : 'tecnologia';

        // Manejo de fecha retroactiva
        const lateSwitch = document.getElementById('exam-late');
        const dateInput = document.getElementById('exam-date');
        let examDate = new Date();

        if (lateSwitch && lateSwitch.checked && dateInput && dateInput.value) {
            const [year, month, day] = dateInput.value.split('-');
            examDate = new Date(year, month - 1, day, 12, 0, 0);
        }

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

        if (!student.exams) student.exams = [];

        let exams = this.getExamsArray(student);
        exams.push({
            id: Date.now().toString(),
            name,
            grade,
            subject,
            date: examDate.toISOString()
        });
        student.exams = exams;

        this.saveData();
        this.updateExamSuggestions();

        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        localStorage.setItem(`ntc_last_exam_${group.id}_${today}`, name);

        this.renderStudentExams(student);
        this.showToast("Calificación de examen guardada.", "success");

        nameInput.value = localStorage.getItem(`ntc_last_exam_${group.id}_${today}`) || '';
        gradeInput.value = '';
        if (subjectSelect) subjectSelect.value = this.currentSubject;

        if (lateSwitch) {
            lateSwitch.checked = false;
            this.handleLateExamChange(false);
        }

        document.querySelectorAll('#quick-grades-exam .btn-grade').forEach(btn => btn.classList.remove('selected'));
    },

    renderStudentExams(student) {
        if (!student) return;
        const list = document.getElementById('exams-list');
        if (!list) return;

        let exams = this.getFilteredExams(student, this.currentSubject);

        if (this.selectedMonth !== 'all') {
            exams = exams.filter(ex => {
                const d = new Date(ex.date);
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return monthKey === this.selectedMonth;
            });
        }

        const count = exams.length;
        const totalText = document.getElementById('exams-total-text');
        if (totalText) {
            totalText.textContent = `${count} Examen${count === 1 ? '' : 'es'}`;
        }

        const avgBadge = document.getElementById('exams-avg-badge');
        const avgText = document.getElementById('exams-avg-text');
        if (avgText) {
            if (count > 0) {
                let total = 0;
                exams.forEach(ex => {
                    total += parseFloat(ex.grade) || 0;
                });
                const avg = (total / count).toFixed(1);
                avgText.textContent = `Promedio: ${avg}`;
                if (avgBadge) avgBadge.style.display = 'inline-flex';
            } else {
                avgText.textContent = `Promedio: -`;
                if (avgBadge) avgBadge.style.display = 'none';
            }
        }

        if (count === 0) {
            list.innerHTML = `<p class="empty-state">No hay exámenes registrados para esta materia.</p>`;
            return;
        }

        list.innerHTML = exams.map(ex => `
            <div class="exam-card">
                <div class="exam-info">
                    <div class="exam-name">
                        <i data-lucide="file-check" style="width: 18px; height: 18px; color: var(--primary);"></i>
                        ${ex.name}
                    </div>
                    <p class="student-meta" style="margin-top: 4px;">${new Date(ex.date).toLocaleDateString()}</p>
                </div>
                <div class="activity-actions">
                    <div class="exam-grade">${ex.grade}</div>
                    <button class="btn-icon admin-only" onclick="app.editExam('${ex.id}')" title="Editar Examen">
                        <i data-lucide="edit-2" style="width:16px"></i>
                    </button>
                    <button class="btn-icon danger admin-only" onclick="app.deleteExam('${ex.id}')" title="Eliminar Examen">
                        <i data-lucide="trash-2" style="width:16px"></i>
                    </button>
                </div>
            </div>
        `).reverse().join('');
        lucide.createIcons();
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
        const subjectSelect = document.getElementById('report-subject');
        const subject = subjectSelect ? subjectSelect.value : 'tecnologia';

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
                subject: subject,
                date: new Date().toISOString()
            });
        });

        student.reports = reports;
        this.saveData();
        this.renderStudentReports(student);
        this.renderStudentActivities(student);

        // Reset form
        checkboxes.forEach(cb => cb.checked = false);
        reasonInput.value = '';
        document.getElementById('indisciplina-reason-group').style.display = 'none';
        if (subjectSelect) subjectSelect.value = this.currentSubject;

        this.showToast("Reporte(s) guardado(s)", "success");
    },

    renderStudentReports(student) {
        if (!student) return;
        const list = document.getElementById('reports-list');
        const reports = this.getFilteredReports(student, this.currentSubject);
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
            this.renderStudentActivities(student);
        }
    },

    // Modal Logic
    modalContext: null,
    openModal(type, targetId = null, currentName = '', studentId = null) {
        const overlay = document.getElementById('modal-container');
        const title = document.getElementById('modal-title');
        const content = document.getElementById('modal-content');
        const confirmBtn = document.getElementById('modal-confirm');

        this.modalContext = { type, targetId, studentId };
        overlay.classList.add('active');

        // Reset display of confirm button
        if (confirmBtn) confirmBtn.style.display = 'block';

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
        } else if (type === 'download-options') {
            const group = this.data.groups.find(g => String(g.id) === String(targetId));
            const months = new Set();
            if (group) {
                const students = this.getStudentsArray(group);
                students.forEach(s => {
                    this.getFilteredActivities(s, this.currentSubject).forEach(act => {
                        if (act.date) {
                            const d = new Date(act.date);
                            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                            months.add(monthKey);
                        }
                    });
                });
            }
            const sortedMonths = Array.from(months).sort().reverse();
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

            title.textContent = 'Opciones de Reporte';
            content.innerHTML = `
                <p style="margin-bottom: 15px; color: var(--text-muted);">Seleccione el periodo y tipo de reporte para <b>${currentName}</b>:</p>
                
                <div class="form-group" style="margin-bottom: 20px;">
                    <label>Periodo (Mes):</label>
                    <select id="modal-select-month" class="premium-select" style="width: 100%;">
                        <option value="all">Todo el historial</option>
                        ${sortedMonths.map(m => {
                            const [year, month] = m.split('-');
                            return `<option value="${m}">${monthNames[parseInt(month) - 1]} ${year}</option>`;
                        }).join('')}
                    </select>
                </div>

                <div style="display: grid; gap: 10px;">
                    <button class="btn-primary" onclick="app.downloadGroupIndividualReports('${targetId}', document.getElementById('modal-select-month').value); app.closeModal();" style="justify-content: center; background-color: var(--accent);">
                        <i data-lucide="download"></i> Descargar / Guardar Individuales en PDF
                    </button>
                    <button class="btn-primary" onclick="app.downloadGroup('${targetId}', document.getElementById('modal-select-month').value); app.closeModal();" style="justify-content: center;">
                        <i data-lucide="file-text"></i> Reporte General (PDF + Excel)
                    </button>
                    <button class="btn-secondary" onclick="app.printGroup('${targetId}', document.getElementById('modal-select-month').value); app.closeModal();" style="justify-content: center; border: 1px solid var(--glass-border); color: var(--text-main);">
                        <i data-lucide="printer"></i> Imprimir Reporte General
                    </button>
                </div>
            `;
            if (confirmBtn) confirmBtn.style.display = 'none';
        } else if (type === 'student-download-options') {
            const student = this.findStudent(this.currentStudentId);
            const months = new Set();
            if (student) {
                // Buscar meses de actividades de TODO el grupo para que las opciones sean consistentes
                const group = this.data.groups.find(g => String(g.id) === String(student.groupId));
                if (group) {
                    const students = this.getStudentsArray(group);
                    students.forEach(s => {
                        this.getFilteredActivities(s, this.currentSubject).forEach(act => {
                            if (act.date) {
                                const d = new Date(act.date);
                                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                months.add(monthKey);
                            }
                        });
                    });
                }
            }
            const sortedMonths = Array.from(months).sort().reverse();
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

            title.textContent = 'Opciones de Reporte';
            content.innerHTML = `
                <p style="margin-bottom: 15px; color: var(--text-muted);">Seleccione el periodo para el reporte de <b>${student.name}</b>:</p>
                
                <div class="form-group" style="margin-bottom: 20px;">
                    <label>Periodo (Mes):</label>
                    <select id="modal-select-month-student" class="premium-select" style="width: 100%;">
                        <option value="all">Todo el historial</option>
                        ${sortedMonths.map(m => {
                            const [year, month] = m.split('-');
                            return `<option value="${m}" ${this.selectedMonth === m ? 'selected' : ''}>${monthNames[parseInt(month) - 1]} ${year}</option>`;
                        }).join('')}
                    </select>
                </div>

                <div style="display: grid; gap: 12px;">
                    <button class="btn-primary" onclick="app.execDownloadStudent(document.getElementById('modal-select-month-student').value); app.closeModal();" style="justify-content: center;">
                        <i data-lucide="download"></i> Descargar / Guardar PDF
                    </button>
                    <button class="btn-secondary" onclick="app.execPrintStudent(document.getElementById('modal-select-month-student').value); app.closeModal();" style="justify-content: center; border: 1px solid var(--glass-border); color: var(--text-main);">
                        <i data-lucide="printer"></i> Imprimir Reporte
                    </button>
                </div>
            `;
            if (confirmBtn) confirmBtn.style.display = 'none';
        } else if (type === 'reset-cycle') {
            title.textContent = 'Reiniciar Ciclo Escolar';
            content.innerHTML = `
                <p style="margin-bottom: 15px; color: var(--text-muted); font-size: 0.9rem;">
                    Seleccione qué información desea eliminar para iniciar el nuevo ciclo escolar:
                </p>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="btn-secondary" onclick="app.resetData('activities_only')" style="justify-content: flex-start; padding: 14px; border: 1px solid rgba(56, 189, 248, 0.3); background: rgba(56, 189, 248, 0.08); text-align: left; width: 100%; cursor: pointer;">
                        <i data-lucide="rotate-ccw" style="color: var(--accent); width: 24px; height: 24px; flex-shrink: 0; margin-right: 10px;"></i>
                        <div>
                            <strong style="display: block; color: var(--text-main); font-size: 0.95rem;">Borrar Actividades y Reportes</strong>
                            <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 2px;">Conserva los grupos y nombres de alumnos, eliminando todas sus tareas, calificaciones y reportes.</span>
                        </div>
                    </button>

                    <button class="btn-danger-outline" onclick="app.resetData('all')" style="justify-content: flex-start; padding: 14px; text-align: left; width: 100%; cursor: pointer;">
                        <i data-lucide="trash-2" style="color: var(--danger); width: 24px; height: 24px; flex-shrink: 0; margin-right: 10px;"></i>
                        <div>
                            <strong style="display: block; color: #f87171; font-size: 0.95rem;">Eliminar Todo (Base de Datos Completa)</strong>
                            <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 2px;">Borra todos los grupos, alumnos, actividades y reportes desde cero.</span>
                        </div>
                    </button>
                </div>
            `;
            if (confirmBtn) confirmBtn.style.display = 'none';
        } else if (type === 'import-students') {
            const group = this.data.groups.find(g => String(g.id) === String(targetId));
            const gName = group ? group.name : currentName;
            title.textContent = `Importar Alumnos a ${gName}`;
            this.pendingImportNames = [];
            this.importTargetGroupId = targetId;
            this.activeImportMode = 'excel';

            content.innerHTML = `
                <div class="import-tabs">
                    <button id="import-tab-excel" class="import-tab-btn active" onclick="app.switchImportTab('excel')">
                        <i data-lucide="file-spreadsheet"></i> Excel / CSV
                    </button>
                    <button id="import-tab-pdf" class="import-tab-btn" onclick="app.switchImportTab('pdf')">
                        <i data-lucide="file-text"></i> PDF
                    </button>
                    <button id="import-tab-photo" class="import-tab-btn" onclick="app.switchImportTab('photo')">
                        <i data-lucide="camera"></i> Foto / Imagen
                    </button>
                </div>

                <div id="import-section-upload">
                    <div id="import-dropzone" class="import-dropzone" onclick="document.getElementById('import-file-input').click()" ondragover="event.preventDefault(); this.classList.add('dragover');" ondragleave="this.classList.remove('dragover');" ondrop="app.handleImportDrop(event)">
                        <i id="import-icon" data-lucide="upload-cloud"></i>
                        <p id="import-dropzone-text" style="font-size: 0.9rem; color: var(--text-muted);">
                            Haz clic o arrastra aquí tu archivo <b>Excel (.xlsx, .csv)</b>
                        </p>
                        <span style="font-size: 0.78rem; color: var(--text-muted); opacity: 0.8;">Procesamiento local 100% privado y seguro.</span>
                        <input type="file" id="import-file-input" style="display:none;" accept=".xlsx, .xls, .csv" onchange="app.handleImportFileSelect(this.files[0])">
                    </div>
                </div>

                <div id="import-status-container" style="display:none; text-align:center; margin: 15px 0;">
                    <div class="import-spinner" style="margin: 0 auto 10px auto;"></div>
                    <p id="import-status-text" style="font-size: 0.88rem; color: var(--accent);">Procesando archivo...</p>
                </div>

                <div id="import-preview-section" style="display:none; margin-top: 15px;">
                    <div class="import-preview-header">
                        <strong style="font-size: 0.9rem; color: var(--text-main);">Alumnos detectados (<span id="import-count-text">0</span>):</strong>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn-text" onclick="app.toggleAllImportItems(true)" style="font-size: 0.78rem; padding: 2px 6px;">Seleccionar todos</button>
                            <button class="btn-text" onclick="app.toggleAllImportItems(false)" style="font-size: 0.78rem; padding: 2px 6px;">Desmarcar todos</button>
                        </div>
                    </div>
                    <div id="import-preview-container" class="import-preview-container"></div>
                </div>
            `;
            if (confirmBtn) {
                confirmBtn.style.display = 'none';
                confirmBtn.textContent = 'Agregar Alumnos al Grupo';
            }
        }
        lucide.createIcons();
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
        } else if (ctx.type === 'import-students') {
            this.confirmImport(ctx.targetId);
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

    editExam(examId) {
        if (!this.isAdmin) {
            this.showToast("No tiene permisos para editar.", "error");
            return;
        }
        const studentRef = this.findStudent(this.currentStudentId);
        if (!studentRef) return;

        const group = this.data.groups.find(g => String(g.id) === String(studentRef.groupId));
        const students = this.getStudentsArray(group);
        const student = students.find(s => String(s.id) === String(studentRef.id));
        const exams = this.getExamsArray(student);
        const exam = exams.find(e => e.id === examId);

        if (!exam) return;

        const newName = prompt('Nombre del examen:', exam.name);
        if (newName === null) return;
        const newGrade = prompt('Calificación del examen:', exam.grade);
        if (newGrade === null) return;

        exam.name = newName;
        exam.grade = newGrade;
        this.saveData();
        this.updateExamSuggestions();
        this.renderStudentExams(student);
        this.showToast("Examen actualizado.", "success");
    },

    deleteExam(examId) {
        if (!this.isAdmin) {
            this.showToast("No tiene permisos para eliminar.", "error");
            return;
        }
        if (!confirm('¿Eliminar este examen?')) return;
        const studentRef = this.findStudent(this.currentStudentId);
        if (!studentRef) return;

        const group = this.data.groups.find(g => String(g.id) === String(studentRef.groupId));
        const students = this.getStudentsArray(group);
        const student = students.find(s => String(s.id) === String(studentRef.id));

        if (student && student.exams) {
            const examsList = Array.isArray(student.exams) ? student.exams : Object.values(student.exams);
            student.exams = examsList.filter(e => e.id !== examId);
            this.saveData();
            this.updateExamSuggestions();
            this.renderStudentExams(student);
            this.showToast("Examen eliminado.", "info");
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

    resetData(type) {
        if (!this.isAdmin) {
            this.showToast("Acceso denegado: Se requieren permisos de maestro.", "error");
            return;
        }

        if (type === 'activities_only') {
            const confirmClear = confirm(
                "⚠️ ¿Estás seguro de que deseas eliminar TODAS las actividades, exámenes y reportes de todos los alumnos?\n\n" +
                "Se mantendrán los grupos y los nombres de los alumnos intactos para el nuevo ciclo escolar."
            );
            if (!confirmClear) return;

            this.data.groups.forEach(g => {
                const students = this.getStudentsArray(g);
                students.forEach(s => {
                    s.activities = [];
                    s.exams = [];
                    s.reports = [];
                });
            });

            // Limpiar datos temporales en localStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('ntc_last_act_') || key.startsWith('ntc_last_exam_')) {
                    localStorage.removeItem(key);
                }
            });

            this.saveData();
            this.closeModal();
            this.renderAdmin();
            this.showToast("¡Actividades, exámenes y reportes eliminados para el nuevo ciclo escolar!", "success");
        } else if (type === 'all') {
            const confirmClear = confirm(
                "🚨 ¡ATENCIÓN! Estás a punto de ELIMINAR TODO.\n\n" +
                "Se borrarán todos los grupos, todos los alumnos y todos sus registros.\n\n" +
                "¿Deseas continuar?"
            );
            if (!confirmClear) return;

            this.data.groups = [];
            this.data.collapsedGroups = [];

            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('ntc_last_act_') || key === 'ntc_collapsed_groups') {
                    localStorage.removeItem(key);
                }
            });

            this.saveData();
            this.closeModal();
            this.renderAdmin();
            this.showToast("Base de datos reiniciada completamente.", "success");
        }
    },

    switchImportTab(mode) {
        this.activeImportMode = mode;
        const btnExcel = document.getElementById('import-tab-excel');
        const btnPdf = document.getElementById('import-tab-pdf');
        const btnPhoto = document.getElementById('import-tab-photo');
        const fileInput = document.getElementById('import-file-input');
        const dropText = document.getElementById('import-dropzone-text');

        [btnExcel, btnPdf, btnPhoto].forEach(b => b && b.classList.remove('active'));

        if (mode === 'excel') {
            if (btnExcel) btnExcel.classList.add('active');
            if (fileInput) fileInput.accept = ".xlsx, .xls, .csv";
            if (dropText) dropText.innerHTML = "Haz clic o arrastra aquí tu archivo <b>Excel (.xlsx, .csv)</b>";
        } else if (mode === 'pdf') {
            if (btnPdf) btnPdf.classList.add('active');
            if (fileInput) fileInput.accept = ".pdf";
            if (dropText) dropText.innerHTML = "Haz clic o arrastra aquí tu documento <b>PDF (.pdf)</b>";
        } else if (mode === 'photo') {
            if (btnPhoto) btnPhoto.classList.add('active');
            if (fileInput) fileInput.accept = "image/*";
            if (dropText) dropText.innerHTML = "Haz clic o arrastra aquí una <b>Foto o Imagen de la lista</b>";
        }
    },

    handleImportDrop(e) {
        e.preventDefault();
        const dropzone = document.getElementById('import-dropzone');
        if (dropzone) dropzone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            this.handleImportFileSelect(e.dataTransfer.files[0]);
        }
    },

    handleImportFileSelect(file) {
        if (!file) return;

        const statusContainer = document.getElementById('import-status-container');
        const statusText = document.getElementById('import-status-text');
        const previewSection = document.getElementById('import-preview-section');
        const confirmBtn = document.getElementById('modal-confirm');

        if (statusContainer) statusContainer.style.display = 'block';
        if (previewSection) previewSection.style.display = 'none';
        if (confirmBtn) confirmBtn.style.display = 'none';

        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
            if (statusText) statusText.textContent = "Leyendo archivo Excel...";
            this.processExcelFile(file);
        } else if (ext === 'pdf') {
            if (statusText) statusText.textContent = "Extrayendo texto del PDF...";
            this.processPdfFile(file);
        } else if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext) || file.type.startsWith('image/')) {
            if (statusText) statusText.textContent = "Analizando foto con OCR... esto tomará unos segundos.";
            this.processPhotoFile(file);
        } else {
            if (statusContainer) statusContainer.style.display = 'none';
            this.showToast("Formato de archivo no soportado.", "error");
        }
    },

    processExcelFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                let rawLines = [];
                json.forEach(row => {
                    if (Array.isArray(row)) {
                        row.forEach(cell => {
                            if (cell && typeof cell === 'string') {
                                rawLines.push(cell.trim());
                            } else if (cell && typeof cell === 'number') {
                                rawLines.push(String(cell));
                            }
                        });
                    }
                });

                const names = this.cleanAndParseNames(rawLines);
                this.renderImportPreview(names);
            } catch (err) {
                console.error("Error al leer Excel:", err);
                this.showToast("Error al procesar el archivo de Excel.", "error");
                document.getElementById('import-status-container').style.display = 'none';
            }
        };
        reader.readAsArrayBuffer(file);
    },

    processPdfFile(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                if (!window.pdfjsLib) {
                    throw new Error("PDF.js no está disponible.");
                }
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
                let rawTextLines = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageLines = textContent.items.map(item => item.str);
                    rawTextLines = rawTextLines.concat(pageLines);
                }

                const names = this.cleanAndParseNames(rawTextLines);
                this.renderImportPreview(names);
            } catch (err) {
                console.error("Error al leer PDF:", err);
                this.showToast("Error al procesar el PDF. Asegúrate de que contenga texto.", "error");
                document.getElementById('import-status-container').style.display = 'none';
            }
        };
        reader.readAsArrayBuffer(file);
    },

    async processPhotoFile(file) {
        if (!window.Tesseract) {
            this.showToast("Librería OCR no disponible.", "error");
            document.getElementById('import-status-container').style.display = 'none';
            return;
        }

        const statusText = document.getElementById('import-status-text');

        try {
            if (statusText) statusText.textContent = "Optimizando contraste e imagen...";
            const processedBlob = await this.preprocessImageForOCR(file);

            if (statusText) statusText.textContent = "Cargando motor de lectura OCR...";

            const worker = await window.Tesseract.createWorker('spa', 1, {
                logger: m => {
                    if (m.status === 'recognizing text' && statusText) {
                        const pct = Math.round((m.progress || 0) * 100);
                        statusText.textContent = `Analizando nombres en la foto... ${pct}%`;
                    }
                }
            });

            // Restringir reconocedor exclusivamente a letras en español y espacios (sin símbolos ni números que dañen nombres)
            await worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZabcdefghijklmnñopqrstuvwxyzÁÉÍÓÚáéíóúñÑ. -',
            });

            const { data: { text } } = await worker.recognize(processedBlob);
            await worker.terminate();

            const rawLines = text.split('\n');
            const names = this.cleanAndParseNames(rawLines);
            this.renderImportPreview(names);
        } catch (err) {
            console.error("Error en Tesseract OCR avanzado:", err);
            // Fallback a reconocedor básico
            window.Tesseract.recognize(file, 'spa')
                .then(({ data: { text } }) => {
                    const rawLines = text.split('\n');
                    const names = this.cleanAndParseNames(rawLines);
                    this.renderImportPreview(names);
                })
                .catch(fallbackErr => {
                    console.error("Error en fallback OCR:", fallbackErr);
                    this.showToast("Error al analizar la imagen.", "error");
                    document.getElementById('import-status-container').style.display = 'none';
                });
        }
    },

    preprocessImageForOCR(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;
                const maxDim = 2000;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                ctx.drawImage(img, 0, 0, width, height);
                const imgData = ctx.getImageData(0, 0, width, height);
                const data = imgData.data;

                // Aumentar contraste para hacer el texto impreso nítido y claro
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    const v = avg < 140 ? Math.max(0, avg - 35) : Math.min(255, avg + 35);
                    data[i] = v;
                    data[i + 1] = v;
                    data[i + 2] = v;
                }
                ctx.putImageData(imgData, 0, 0);

                canvas.toBlob((blob) => {
                    resolve(blob || file);
                }, 'image/png');
            };
            img.onerror = () => resolve(file);
            img.src = url;
        });
    },

    cleanAndParseNames(lines) {
        const ignoreKeywords = [
            'nombre', 'alumnos', 'lista', 'asistencia', 'materia', 'profesor', 'maestro',
            'grupo', 'grado', 'escuela', 'colegio', 'ciclo', 'fecha', 'firma', 'calificacion',
            'promedio', 'examen', 'tarea', 'reporte', 'folio', 'no.', 'num', 'tecnologia', 'robotica', 'cultura-digital', 'culturadigital'
        ];

        const names = [];
        lines.forEach(line => {
            if (!line || typeof line !== 'string') return;

            let clean = line.trim();

            // Quitar numeración inicial tipo "1. ", "01.- ", "1) ", "1 - "
            clean = clean.replace(/^[0-9]{1,3}\s*[\.\-\)\:]\s*/, '').trim();
            clean = clean.replace(/^[0-9]{1,3}\s+/, '').trim();

            // Filtrar cualquier símbolo extraño que no pertenezca al idioma español
            clean = clean.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s\.\-]/g, '').trim();

            // Normalizar múltiples espacios intermedios
            clean = clean.replace(/\s+/g, ' ');

            if (clean.length < 3) return; // Ignorar muy cortos
            if (/^[0-9\/\-\.\,\s]+$/.test(clean)) return; // Ignorar si son solo números

            const lower = clean.toLowerCase();
            const containsIgnoredWord = ignoreKeywords.some(kw => lower === kw || lower.startsWith(kw + ' ') || lower.includes('lista de'));
            if (containsIgnoredWord) return;

            // Formatear respetando la ortografía original y tildes en Capital Case
            const formatted = clean.split(' ').map(word => {
                if (!word) return '';
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }).filter(Boolean).join(' ');

            if (formatted.length >= 3 && !names.includes(formatted)) {
                names.push(formatted);
            }
        });

        return names;
    },

    renderImportPreview(names) {
        const statusContainer = document.getElementById('import-status-container');
        const previewSection = document.getElementById('import-preview-section');
        const previewContainer = document.getElementById('import-preview-container');
        const countText = document.getElementById('import-count-text');
        const confirmBtn = document.getElementById('modal-confirm');

        if (statusContainer) statusContainer.style.display = 'none';

        if (!names || names.length === 0) {
            this.showToast("No se encontraron nombres válidos de alumnos.", "error");
            return;
        }

        this.pendingImportNames = names;

        if (countText) countText.textContent = names.length;
        if (previewContainer) {
            previewContainer.innerHTML = names.map((name, index) => `
                <div class="import-preview-item">
                    <input type="checkbox" id="import-check-${index}" checked style="width: 18px; height: 18px; cursor: pointer;">
                    <input type="text" id="import-name-${index}" value="${name}">
                    <button class="btn-icon danger" onclick="this.parentElement.remove(); app.updateImportCount();" title="Eliminar de la lista" style="padding: 2px;">
                        <i data-lucide="x" style="width: 16px; height: 16px;"></i>
                    </button>
                </div>
            `).join('');
            lucide.createIcons();
        }

        if (previewSection) previewSection.style.display = 'block';
        if (confirmBtn) confirmBtn.style.display = 'block';
    },

    toggleAllImportItems(checked) {
        const container = document.getElementById('import-preview-container');
        if (!container) return;
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = checked);
    },

    updateImportCount() {
        const container = document.getElementById('import-preview-container');
        const countText = document.getElementById('import-count-text');
        if (container && countText) {
            const count = container.querySelectorAll('.import-preview-item').length;
            countText.textContent = count;
        }
    },

    confirmImport(groupId) {
        const container = document.getElementById('import-preview-container');
        if (!container) return;

        const items = container.querySelectorAll('.import-preview-item');
        const selectedNames = [];

        items.forEach(item => {
            const cb = item.querySelector('input[type="checkbox"]');
            const nameInput = item.querySelector('input[type="text"]');
            if (cb && cb.checked && nameInput && nameInput.value.trim()) {
                selectedNames.push(nameInput.value.trim());
            }
        });

        if (selectedNames.length === 0) {
            this.showToast("Seleccione al menos un alumno para importar.", "error");
            return;
        }

        const group = this.data.groups.find(g => String(g.id) === String(groupId));
        if (!group) {
            this.showToast("No se encontró el grupo de destino.", "error");
            return;
        }

        if (!group.students) group.students = [];
        if (!Array.isArray(group.students)) group.students = this.getStudentsArray(group);

        selectedNames.forEach(name => {
            group.students.push({
                id: Math.random().toString(36).substr(2, 9),
                name: name,
                activities: [],
                reports: []
            });
        });

        this.saveData();
        this.closeModal();
        this.renderAdmin();
        this.showToast(`¡Se agregaron ${selectedNames.length} alumnos a ${group.name}!`, "success");
    },

    // Printing Logic
    // Reporting Logic (Print & Download)
    printStudent() {
        this.openModal('student-download-options');
        lucide.createIcons();
    },

    downloadStudent() {
        this.openModal('student-download-options');
        lucide.createIcons();
    },

    execPrintStudent(month) {
        const student = this.findStudent(this.currentStudentId);
        if (!student) {
            this.showToast("No se encontró el alumno", "error");
            return;
        }
        const monthSuffix = month !== 'all' ? `_${month}` : '';
        const subjectSuffix = this.getSubjectSuffix();
        const safeName = (student.name || 'Alumno').replace(/[\\/:*?"<>|]/g, '_');
        const filename = `Reporte_${safeName}${subjectSuffix}${monthSuffix}.pdf`;

        this.showToast("Abriendo reporte para Guardar como PDF...", "info");
        const html = `
            <div class="pdf-page" style="box-sizing: border-box;">
                ${this.getStudentReportHTML(student, month)}
            </div>
        `;
        this.execPrint(html, filename);
    },

    execDownloadStudent(month) {
        this.execPrintStudent(month);
    },

    printGroup(groupId, month = 'all') {
        const group = this.data.groups.find(g => String(g.id) === String(groupId));
        if (!group) return;
        const monthSuffix = month !== 'all' ? `_${month}` : '';
        const subjectSuffix = this.getSubjectSuffix();
        const safeGroupName = (group.name || 'Grupo').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Reporte_General_${safeGroupName}${subjectSuffix}${monthSuffix}.pdf`;
        const html = this.getGroupReportHTML(group, month);
        this.execPrint(html, filename);
    },

    downloadGroup(groupId, month = 'all') {
        this.printGroup(groupId, month);
        // También descargar el Excel automáticamente
        this.downloadGroupExcel(groupId, month);
    },

    downloadGroupExcel(groupId, filterMonth = 'all') {
        const group = this.data.groups.find(g => String(g.id) === String(groupId));
        if (!group) return;

        const students = this.getStudentsArray(group);
        if (students.length === 0) {
            this.showToast('No hay alumnos para exportar a Excel.', 'error');
            return;
        }

        // ==========================================
        // 1. RECOPILAR ACTIVIDADES DIARIAS (SIN EXÁMENES)
        // ==========================================
        let maxActs = 0;
        students.forEach(s => {
            let acts = this.getFilteredActivities(s, this.currentSubject);
            if (filterMonth !== 'all') {
                acts = acts.filter(act => {
                    const d = new Date(act.date);
                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return monthKey === filterMonth;
                });
            }
            if (acts.length > maxActs) maxActs = acts.length;
        });

        const activityHeaders = [];
        for (let i = 0; i < maxActs; i++) {
            const studentWithAct = students.find(s => {
                let acts = this.getFilteredActivities(s, this.currentSubject);
                if (filterMonth !== 'all') {
                    acts = acts.filter(act => {
                        const d = new Date(act.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                return !!acts[i];
            });
            if (studentWithAct) {
                let acts = this.getFilteredActivities(studentWithAct, this.currentSubject);
                if (filterMonth !== 'all') {
                    acts = acts.filter(act => {
                        const d = new Date(act.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                activityHeaders.push(acts[i].name || `Actividad ${i + 1}`);
            } else {
                activityHeaders.push(`Actividad ${i + 1}`);
            }
        }

        const actHeader = ['Alumno', ...activityHeaders, 'Promedio Actividades'];
        const actRows = [actHeader];

        students.forEach(student => {
            let acts = this.getFilteredActivities(student, this.currentSubject);
            if (filterMonth !== 'all') {
                acts = acts.filter(act => {
                    const d = new Date(act.date);
                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return monthKey === filterMonth;
                });
            }

            const grades = [];
            let total = 0;
            for (let i = 0; i < maxActs; i++) {
                const g = acts[i] ? parseFloat(acts[i].grade) || 0 : 0;
                grades.push(g);
                total += g;
            }
            const avg = maxActs > 0 ? parseFloat((total / maxActs).toFixed(1)) : 0;
            actRows.push([student.name, ...grades, avg]);
        });

        // ==========================================
        // 2. RECOPILAR EXÁMENES (SOLO EXÁMENES)
        // ==========================================
        let maxExams = 0;
        students.forEach(s => {
            let exList = this.getFilteredExams(s, this.currentSubject);
            if (filterMonth !== 'all') {
                exList = exList.filter(ex => {
                    const d = new Date(ex.date);
                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return monthKey === filterMonth;
                });
            }
            if (exList.length > maxExams) maxExams = exList.length;
        });

        const examHeaders = [];
        for (let i = 0; i < maxExams; i++) {
            const studentWithExam = students.find(s => {
                let exList = this.getFilteredExams(s, this.currentSubject);
                if (filterMonth !== 'all') {
                    exList = exList.filter(ex => {
                        const d = new Date(ex.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                return !!exList[i];
            });
            if (studentWithExam) {
                let exList = this.getFilteredExams(studentWithExam, this.currentSubject);
                if (filterMonth !== 'all') {
                    exList = exList.filter(ex => {
                        const d = new Date(ex.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                examHeaders.push(exList[i].name || `Examen ${i + 1}`);
            } else {
                examHeaders.push(`Examen ${i + 1}`);
            }
        }

        const examHeader = maxExams > 0 ? ['Alumno', ...examHeaders, 'Promedio Exámenes'] : ['Alumno', 'Sin exámenes registrados', 'Promedio Exámenes'];
        const examRows = [examHeader];

        students.forEach(student => {
            let exList = this.getFilteredExams(student, this.currentSubject);
            if (filterMonth !== 'all') {
                exList = exList.filter(ex => {
                    const d = new Date(ex.date);
                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return monthKey === filterMonth;
                });
            }

            if (maxExams === 0) {
                examRows.push([student.name, '-', '-']);
            } else {
                const grades = [];
                let total = 0;
                let count = 0;
                for (let i = 0; i < maxExams; i++) {
                    if (exList[i] && exList[i].grade !== undefined && exList[i].grade !== '') {
                        const g = parseFloat(exList[i].grade) || 0;
                        grades.push(g);
                        total += g;
                        count++;
                    } else {
                        grades.push('-');
                    }
                }
                const avg = count > 0 ? parseFloat((total / count).toFixed(1)) : '-';
                examRows.push([student.name, ...grades, avg]);
            }
        });

        // 3. Crear libro de Excel con SheetJS
        if (typeof XLSX === 'undefined') {
            this.showToast('La librería Excel no está disponible. Verifique su conexión.', 'error');
            return;
        }

        const wb = XLSX.utils.book_new();
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        // --- Hoja 1: Calificaciones de Actividades ---
        const wsActs = XLSX.utils.aoa_to_sheet(actRows);
        wsActs['!cols'] = actHeader.map((h, ci) => {
            let max = h.length;
            actRows.slice(1).forEach(row => {
                const val = row[ci] !== undefined ? String(row[ci]) : '';
                if (val.length > max) max = val.length;
            });
            return { wch: Math.min(Math.max(max + 2, 10), 40) };
        });

        let actSheetName = 'Actividades';
        if (filterMonth !== 'all') {
            const [year, month] = filterMonth.split('-');
            actSheetName = `Actividades - ${monthNames[parseInt(month) - 1]}`;
        }
        XLSX.utils.book_append_sheet(wb, wsActs, actSheetName);

        // --- Hoja 2: Calificaciones de Exámenes (Separado exclusivamente para exámenes) ---
        const wsExams = XLSX.utils.aoa_to_sheet(examRows);
        wsExams['!cols'] = examHeader.map((h, ci) => {
            let max = h.length;
            examRows.slice(1).forEach(row => {
                const val = row[ci] !== undefined ? String(row[ci]) : '';
                if (val.length > max) max = val.length;
            });
            return { wch: Math.min(Math.max(max + 2, 10), 40) };
        });

        let examSheetName = 'Exámenes';
        if (filterMonth !== 'all') {
            const [year, month] = filterMonth.split('-');
            examSheetName = `Exámenes - ${monthNames[parseInt(month) - 1]}`;
        }
        XLSX.utils.book_append_sheet(wb, wsExams, examSheetName);

        // --- Hoja 3: Tabla de Actividades Desarrolladas ---
        const toRoman = (num) => {
            const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
            const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
            let result = '';
            vals.forEach((v, i) => { while (num >= v) { result += syms[i]; num -= v; } });
            return result;
        };

        const shortMonthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const subjectLabel = this.getSubjectLabel();

        const activityDates = [];
        for (let i = 0; i < maxActs; i++) {
            let foundDate = null;
            students.forEach(s => {
                if (foundDate) return;
                let acts = this.getFilteredActivities(s, this.currentSubject);
                if (filterMonth !== 'all') {
                    acts = acts.filter(act => {
                        const d = new Date(act.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                if (acts[i] && acts[i].date) {
                    foundDate = new Date(acts[i].date);
                }
            });
            activityDates.push(foundDate);
        }

        const tableRows = [];
        tableRows.push(['Tabla de actividades desarrolladas - ' + subjectLabel, '', '', '', '']);
        tableRows.push(['Número de Actividad', 'Título de la Actividad', 'Día', 'Mes', 'Año']);

        for (let i = 0; i < maxActs; i++) {
            const d = activityDates[i];
            const roman = toRoman(i + 1);
            const actName = activityHeaders[i] || `Actividad ${i + 1}`;
            const day   = d ? d.getDate() : '';
            const mon   = d ? shortMonthNames[d.getMonth()] : '';
            const yr    = d ? d.getFullYear() : '';
            tableRows.push([roman, actName, day, mon, yr]);
        }

        const ws3 = XLSX.utils.aoa_to_sheet(tableRows);
        ws3['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
        ws3['!cols'] = [
            { wch: 18 },
            { wch: 45 },
            { wch: 8  },
            { wch: 14 },
            { wch: 8  }
        ];
        XLSX.utils.book_append_sheet(wb, ws3, 'Tabla de Actividades');

        // --- Hoja 4: Tabla de Exámenes Desarrollados / Aplicados ---
        const examDates = [];
        for (let i = 0; i < maxExams; i++) {
            let foundDate = null;
            students.forEach(s => {
                if (foundDate) return;
                let exList = this.getFilteredExams(s, this.currentSubject);
                if (filterMonth !== 'all') {
                    exList = exList.filter(ex => {
                        const d = new Date(ex.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                if (exList[i] && exList[i].date) {
                    foundDate = new Date(exList[i].date);
                }
            });
            examDates.push(foundDate);
        }

        const examTableRows = [];
        examTableRows.push(['Tabla de exámenes aplicados - ' + subjectLabel, '', '', '', '']);
        examTableRows.push(['Número de Examen', 'Título del Examen', 'Día', 'Mes', 'Año']);

        if (maxExams === 0) {
            examTableRows.push(['-', 'Sin exámenes registrados en este periodo', '', '', '']);
        } else {
            for (let i = 0; i < maxExams; i++) {
                const d = examDates[i];
                const roman = toRoman(i + 1);
                const exName = examHeaders[i] || `Examen ${i + 1}`;
                const day   = d ? d.getDate() : '';
                const mon   = d ? shortMonthNames[d.getMonth()] : '';
                const yr    = d ? d.getFullYear() : '';
                examTableRows.push([roman, exName, day, mon, yr]);
            }
        }

        const ws4 = XLSX.utils.aoa_to_sheet(examTableRows);
        ws4['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
        ws4['!cols'] = [
            { wch: 18 },
            { wch: 45 },
            { wch: 8  },
            { wch: 14 },
            { wch: 8  }
        ];
        XLSX.utils.book_append_sheet(wb, ws4, 'Tabla de Exámenes');

        const monthSuffix = filterMonth !== 'all' ? `_${filterMonth}` : '';
        const subjectSuffix = this.getSubjectSuffix();
        const filename = `Calificaciones_${group.name.replace(/ /g, '_')}${subjectSuffix}${monthSuffix}.xlsx`;
        XLSX.writeFile(wb, filename);
        this.showToast('Excel descargado correctamente con hojas separadas para Actividades y Exámenes.', 'success');
    },


    downloadGroupOptions(groupId, groupName) {
        this.openModal('download-options', groupId, groupName);
        lucide.createIcons();
    },

    printGroupIndividualReports(groupId, month = 'all') {
        const group = this.data.groups.find(g => String(g.id) === String(groupId));
        if (!group) return;

        const students = this.getStudentsArray(group);
        if (students.length === 0) {
            this.showToast("No hay alumnos en este grupo", "error");
            return;
        }

        const monthSuffix = month !== 'all' ? `_${month}` : '';
        const subjectSuffix = this.getSubjectSuffix();
        const safeGroupName = (group.name || 'Grupo').replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `Reportes_Individuales_${safeGroupName}${subjectSuffix}${monthSuffix}.pdf`;

        this.showToast(`Preparando ${students.length} reportes individuales para Guardar como PDF...`, "info");

        let fullHtml = "";
        students.forEach((student, index) => {
            const studentWithGroup = this.findStudent(student.id);
            if (!studentWithGroup) return;
            fullHtml += `
                <div class="pdf-page" style="page-break-after: always; break-after: page; box-sizing: border-box;">
                    ${this.getStudentReportHTML(studentWithGroup, month)}
                </div>
            `;
        });

        this.execPrint(fullHtml, filename);
    },

    downloadGroupIndividualReports(groupId, month = 'all') {
        this.printGroupIndividualReports(groupId, month);
    },

    getStudentPublicUrl(studentId) {
        if (!studentId) return 'https://ntc-registro.web.app/';
        let base = window.location.origin + window.location.pathname;
        if (!window.location.origin || window.location.origin === 'null' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') {
            base = 'https://ntc-registro.web.app/';
        }
        return `${base.replace(/\/+$/, '')}/#student/${studentId}`;
    },

    generateQRCodeDataURL(text) {
        return generateQRCodeDataURL(text);
    },

    getStudentReportHTML(student, filterMonth = 'all') {
        let activities = this.getFilteredActivities(student, this.currentSubject);
        let exams = this.getFilteredExams(student, this.currentSubject);
        const reports = this.getFilteredReports(student, this.currentSubject);

        // Filtrar actividades y exámenes por mes si es necesario
        if (filterMonth !== 'all') {
            activities = activities.filter(act => {
                const d = new Date(act.date);
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return monthKey === filterMonth;
            });
            exams = exams.filter(ex => {
                const d = new Date(ex.date);
                const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return monthKey === filterMonth;
            });
        }

        // Calcular promedio de exámenes
        let examTotal = 0;
        let examCount = 0;
        exams.forEach(ex => {
            if (ex.grade !== undefined && ex.grade !== '') {
                examTotal += parseFloat(ex.grade) || 0;
                examCount++;
            }
        });
        const examAvg = examCount > 0 ? (examTotal / examCount).toFixed(1) : '-';

        // Calcular progreso y actividades faltantes
        const group = this.data.groups.find(g => String(g.id) === String(student.groupId));
        let maxStudentActs = [];
        let maxCount = 0;

        if (group) {
            const studentsInGroup = this.getStudentsArray(group);
            studentsInGroup.forEach(s => {
                let sActs = this.getFilteredActivities(s, this.currentSubject);
                if (filterMonth !== 'all') {
                    sActs = sActs.filter(act => {
                        const d = new Date(act.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                if (sActs.length > maxCount) {
                    maxCount = sActs.length;
                    maxStudentActs = sActs;
                }
            });
        }

        const currentActNames = activities.map(a => a.name.trim().toLowerCase());
        const missingActNames = maxStudentActs
            .filter(a => !currentActNames.includes(a.name.trim().toLowerCase()))
            .map(a => a.name);

        const totalPossible = maxCount || (filterMonth === 'all' ? 0 : 0);
        const currentCount = activities.length;

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        let monthTitle = "";
        if (filterMonth !== 'all') {
            const [year, month] = filterMonth.split('-');
            monthTitle = ` - ${monthNames[parseInt(month) - 1]} ${year}`;
        }

        const subjectLabel = this.getSubjectLabel();
        const studentId = student.id || this.currentStudentId;
        const studentPublicUrl = this.getStudentPublicUrl(studentId);
        const qrDataUrl = this.generateQRCodeDataURL(studentPublicUrl);

        return `
            <style>
                @page {
                    size: A4 portrait;
                    margin: 6mm 8mm;
                }
                @media print {
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    .pdf-body { padding: 0 !important; }
                    .page-break { page-break-after: always !important; break-after: page !important; }
                }
                .pdf-body { font-family: Arial, sans-serif; padding: 3mm 6mm; color: #1e293b; box-sizing: border-box; }
                .report-title { color: #4f46e5; margin: 0 0 4px 0; font-size: 15pt; font-weight: bold; }
                table.report-table { width: 100%; border-collapse: collapse; margin-top: 5px; margin-bottom: 5px; }
                table.report-table th, table.report-table td { border: 1px solid #cbd5e1; padding: 3px 6px; text-align: left; font-size: 8.5pt; }
                table.report-table th { background: #f1f5f9; font-weight: 600; color: #1e293b; }
                .danger-title { color: #ef4444; margin-top: 5px; margin-bottom: 3px; font-size: 9.5pt; font-weight: bold; }
                .summary-box { background: #f8fafc; border: 1px solid #c7d2fe; padding: 5px 8px; border-radius: 6px; margin-top: 5px; font-size: 8.5pt; }
                .summary-item { margin: 1px 0; font-size: 8.5pt; color: #1e293b; }
                .missing-list { color: #b91c1c; font-weight: bold; margin-top: 1px; font-size: 8pt; }
                .completed-msg { color: #059669; font-weight: 700; font-size: 8.5pt; margin: 1px 0; }
                .signature-section { margin-top: 10px; margin-bottom: 6px; page-break-inside: avoid; }
                .qr-section { margin-top: 6px; padding: 5px 8px; border: 1.5px dashed #94a3b8; border-radius: 6px; background: #f8fafc; page-break-inside: avoid; }
            </style>
            <div class="pdf-body">
                <h1 class="report-title">Historial del Alumno - ${subjectLabel}${monthTitle}</h1>
                
                <table style="width: 100%; border-collapse: collapse; border: none; margin: 6px 0 8px 0;">
                    <tr>
                        <td style="width: 50%; border: none; padding: 2px 8px 2px 0; font-size: 9pt; color: #334155; line-height: 1.3;">
                            <strong>Alumno:</strong> ${student.name}
                        </td>
                        <td style="width: 50%; border: none; padding: 2px 0 2px 8px; font-size: 9pt; color: #334155; line-height: 1.3;">
                            <strong>Grupo:</strong> ${student.groupName || '-'}
                        </td>
                    </tr>
                    <tr>
                        <td style="width: 50%; border: none; padding: 2px 8px 2px 0; font-size: 9pt; color: #334155; line-height: 1.3;">
                            <strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString()}
                        </td>
                        <td style="width: 50%; border: none; padding: 2px 0 2px 8px; font-size: 9pt; color: #334155; line-height: 1.3;">
                            <strong>Reportes Totales:</strong> ${reports.length}
                        </td>
                    </tr>
                    ${filterMonth !== 'all' ? `
                    <tr>
                        <td colspan="2" style="border: none; padding: 2px 0; font-size: 9pt; color: #334155; line-height: 1.3;">
                            <strong>Mes del Reporte:</strong> ${monthTitle.replace(' - ', '')}
                        </td>
                    </tr>
                    ` : ''}
                </table>
                
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 8px 0;">
                
                <!-- Apartado: Actividades y Tareas Diarias -->
                <div style="font-size: 11pt; font-weight: bold; margin-top: 4px; margin-bottom: 4px; color: #1e293b;">Actividades y Tareas Realizadas</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th style="width: 25%;">Fecha</th>
                            <th style="width: 55%;">Actividad</th>
                            <th style="width: 20%; text-align: right;">Calificación</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activities.length > 0 ? activities.map(act => `
                            <tr>
                                <td>${new Date(act.date).toLocaleDateString()}</td>
                                <td>${act.name}</td>
                                <td style="text-align: right; font-weight: bold;">${act.grade}</td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="3" style="text-align: center; color: #64748b; font-style: italic;">Sin actividades registradas en este periodo</td>
                            </tr>
                        `}
                    </tbody>
                </table>

                <div class="summary-box">
                    <p class="summary-item"><strong>Resumen de Progreso de Actividades:</strong> ${currentCount} actividades de ${totalPossible} totales (${currentCount}/${totalPossible})</p>
                    ${missingActNames.length > 0 ? `
                        <p class="summary-item"><strong>Actividades faltantes:</strong></p>
                        <p class="missing-list">${missingActNames.join(', ')}</p>
                    ` : '<p class="completed-msg">¡Felicidades! Todas las actividades han sido completadas.</p>'}
                </div>

                <!-- Apartado: Exámenes (Exclusivo para Exámenes) -->
                <div style="font-size: 11pt; font-weight: bold; margin-top: 10px; margin-bottom: 4px; color: #4f46e5; display: flex; justify-content: space-between; align-items: center;">
                    <span>Exámenes y Evaluaciones</span>
                    ${exams.length > 0 ? `<span style="font-size: 8.5pt; font-weight: bold; color: #334155; background: #eef2ff; border: 1px solid #c7d2fe; padding: 2px 8px; border-radius: 4px;">Promedio Exámenes: <span style="color: #4f46e5;">${examAvg}</span></span>` : ''}
                </div>
                <table class="report-table">
                    <thead>
                        <tr style="background: #eef2ff;">
                            <th style="width: 25%;">Fecha</th>
                            <th style="width: 55%;">Examen</th>
                            <th style="width: 20%; text-align: right;">Calificación</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exams.length > 0 ? exams.map(ex => `
                            <tr>
                                <td>${new Date(ex.date).toLocaleDateString()}</td>
                                <td style="font-weight: 600; color: #1e293b;">${ex.name}</td>
                                <td style="text-align: right; font-weight: bold; color: #4f46e5;">${ex.grade}</td>
                            </tr>
                        `).join('') : `
                            <tr>
                                <td colspan="3" style="text-align: center; color: #64748b; font-style: italic;">Sin exámenes registrados en este periodo</td>
                            </tr>
                        `}
                    </tbody>
                </table>

                ${(reports.length > 0) ? `
                <div class="danger-title">Historial de Reportes</div>
                <table class="report-table">
                    <thead>
                        <tr style="background: #fef2f2;">
                            <th style="width: 20%;">Fecha</th>
                            <th style="width: 30%;">Tipo</th>
                            <th style="width: 50%;">Motivo / Comentario</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reports.map(rep => `
                            <tr>
                                <td>${new Date(rep.date).toLocaleDateString()}</td>
                                <td style="color: #ef4444; font-weight: bold;">${rep.label}</td>
                                <td style="font-style: italic;">${rep.reason || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}

                <!-- Apartado: Nombre y firma de responsable -->
                <div class="signature-section">
                    <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                        <tr>
                            <td style="border: none; padding: 0; text-align: center;">
                                <div style="display: inline-block; width: 300px; text-align: center;">
                                    <div style="height: 32px;"></div>
                                    <div style="border-top: 1.5px solid #475569; padding-top: 4px;">
                                        <p style="margin: 0; font-weight: bold; color: #1e293b; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px;">
                                            Nombre y firma de responsable
                                        </p>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Apartado: Código QR para consultar progreso -->
                <div class="qr-section">
                    <table style="width: 100%; border-collapse: collapse; border: none; margin: 0;">
                        <tr>
                            <td style="width: 75px; vertical-align: middle; border: none; padding: 2px; text-align: center;">
                                <div style="background: #ffffff; padding: 2px; border-radius: 6px; border: 1px solid #cbd5e1; display: inline-block;">
                                    <img src="${qrDataUrl}" width="65" height="65" style="display: block; width: 65px; height: 65px;" alt="Código QR para consulta de progreso" />
                                </div>
                            </td>
                            <td style="vertical-align: middle; border: none; padding: 2px 0 2px 12px;">
                                <div style="margin-bottom: 2px;">
                                    <strong style="color: #1e293b; font-size: 9.5pt;">📱 Consulta de Progreso en Cualquier Momento</strong>
                                </div>
                                <p style="margin: 0 0 4px 0; font-size: 8pt; color: #475569; line-height: 1.35;">
                                    Escanee este código QR con la cámara de su celular para consultar el avance actualizado, actividades entregadas, exámenes y reportes de <strong>${student.name}</strong> en cualquier momento.
                                </p>
                                <div style="font-size: 7.5pt; color: #64748b; word-break: break-all;">
                                    <strong>Enlace directo:</strong> <span style="color: #4f46e5;">${studentPublicUrl}</span>
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        `;
    },

    getGroupReportHTML(group, filterMonth = 'all') {
        const students = this.getStudentsArray(group);
        
        // Determinar el máximo de actividades para el periodo (mes o todo)
        let maxActs = 0;
        if (filterMonth !== 'all') {
            students.forEach(s => {
                const sActs = this.getFilteredActivities(s, this.currentSubject).filter(act => {
                    const d = new Date(act.date);
                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return monthKey === filterMonth;
                });
                if (sActs.length > maxActs) maxActs = sActs.length;
            });
        } else {
            maxActs = this.getMaxActivitiesForGroup(group, this.currentSubject);
        }

        let activityList = [];
        for (let i = 0; i < maxActs; i++) {
            const studentWithAct = students.find(s => {
                let acts = this.getFilteredActivities(s, this.currentSubject);
                if (filterMonth !== 'all') {
                    acts = acts.filter(act => {
                        const d = new Date(act.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                return acts[i];
            });
            
            let sample = null;
            if (studentWithAct) {
                let acts = this.getFilteredActivities(studentWithAct, this.currentSubject);
                if (filterMonth !== 'all') {
                    acts = acts.filter(act => {
                        const d = new Date(act.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                sample = acts[i];
            }

            if (sample) {
                activityList.push({ num: i + 1, name: sample.name, date: new Date(sample.date).toLocaleDateString() });
            } else {
                activityList.push({ num: i + 1, name: `Actividad ${i + 1}`, date: '-' });
            }
        }

        // Determinar el máximo de exámenes para el periodo
        let maxExams = 0;
        if (filterMonth !== 'all') {
            students.forEach(s => {
                const sExams = this.getFilteredExams(s, this.currentSubject).filter(ex => {
                    const d = new Date(ex.date);
                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return monthKey === filterMonth;
                });
                if (sExams.length > maxExams) maxExams = sExams.length;
            });
        } else {
            maxExams = this.getMaxExamsForGroup(group, this.currentSubject);
        }

        let examList = [];
        for (let i = 0; i < maxExams; i++) {
            const studentWithExam = students.find(s => {
                let exList = this.getFilteredExams(s, this.currentSubject);
                if (filterMonth !== 'all') {
                    exList = exList.filter(ex => {
                        const d = new Date(ex.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                return exList[i];
            });

            let sample = null;
            if (studentWithExam) {
                let exList = this.getFilteredExams(studentWithExam, this.currentSubject);
                if (filterMonth !== 'all') {
                    exList = exList.filter(ex => {
                        const d = new Date(ex.date);
                        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        return monthKey === filterMonth;
                    });
                }
                sample = exList[i];
            }

            if (sample) {
                examList.push({ num: i + 1, name: sample.name, date: new Date(sample.date).toLocaleDateString() });
            } else {
                examList.push({ num: i + 1, name: `Examen ${i + 1}`, date: '-' });
            }
        }

        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        let monthTitle = "";
        if (filterMonth !== 'all') {
            const [year, month] = filterMonth.split('-');
            monthTitle = ` - ${monthNames[parseInt(month) - 1]} ${year}`;
        }

        const subjectLabel = this.getSubjectLabel();

        return `
            <style>
                .pdf-body { font-family: Arial, sans-serif; padding: 10mm; color: #1e293b; width: 100%; box-sizing: border-box; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-size: 9pt; }
                .text-left { text-align: left; }
                .heading { color: #6366f1; margin: 0 0 5px 0; font-size: 20pt; }
                .sub-heading { font-size: 13pt; border-bottom: 2px solid #6366f1; padding-bottom: 3px; color: #1e293b; margin-top: 15px; }
                .page-break { page-break-before: always; }
                .header-info { display: flex; gap: 30px; margin-top: 8px; margin-bottom: 15px; font-size: 10pt; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
                .signature-container { display: flex; justify-content: center; margin-top: 30px; page-break-inside: avoid; }
                .signature-box { width: 250px; text-align: center; }
            </style>
            <div class="pdf-body">
                <h1 class="heading">Lista de cotejo${monthTitle}</h1>
                <div class="header-info">
                    <span><strong>Materia:</strong> ${subjectLabel}</span>
                    <span><strong>Grado y Grupo:</strong> ${group.name}</span>
                    <span><strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString()}</span>
                </div>
                
                <h2 class="sub-heading">Cuadro de Actividades Diarias</h2>
                <table>
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th class="text-left">Alumno</th>
                            ${activityList.map(a => `<th>Act ${a.num}</th>`).join('')}
                            <th style="background: #e0e7ff;">Prom. Act</th>
                            <th style="background: #fee2e2;">Rep</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(student => {
                            let total = 0;
                            let acts = this.getFilteredActivities(student, this.currentSubject);
                            if (filterMonth !== 'all') {
                                acts = acts.filter(act => {
                                    const d = new Date(act.date);
                                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                    return monthKey === filterMonth;
                                });
                            }
                            const reports = this.getFilteredReports(student, this.currentSubject);
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
                                    <td class="text-left" style="font-weight: 600;">${student.name}</td>
                                    ${studentGrades.map(g => `<td style="color: ${g === 0 ? '#94a3b8' : '#1e293b'}">${g}</td>`).join('')}
                                    <td style="font-weight: bold; background: #f8fafc;">${avg}</td>
                                    <td style="font-weight: bold; color: ${reportCount > 0 ? '#ef4444' : '#94a3b8'}">${reportCount}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <!-- Apartado: Cuadro de Exámenes (Separado exclusivamente para exámenes) -->
                <h2 class="sub-heading" style="margin-top: 25px; border-bottom-color: #4f46e5; color: #312e81;">Cuadro de Exámenes</h2>
                ${maxExams > 0 ? `
                <table>
                    <thead>
                        <tr style="background: #eef2ff;">
                            <th class="text-left">Alumno</th>
                            ${examList.map(e => `<th>Ex ${e.num}</th>`).join('')}
                            <th style="background: #e0e7ff; color: #4338ca;">Prom. Exámenes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(student => {
                            let total = 0;
                            let exList = this.getFilteredExams(student, this.currentSubject);
                            if (filterMonth !== 'all') {
                                exList = exList.filter(ex => {
                                    const d = new Date(ex.date);
                                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                    return monthKey === filterMonth;
                                });
                            }
                            const examGrades = [];
                            let countWithGrade = 0;

                            for (let i = 0; i < maxExams; i++) {
                                if (exList[i] && exList[i].grade !== undefined && exList[i].grade !== '') {
                                    const gradeVal = parseFloat(exList[i].grade) || 0;
                                    examGrades.push(gradeVal);
                                    total += gradeVal;
                                    countWithGrade++;
                                } else {
                                    examGrades.push('-');
                                }
                            }
                            const avg = countWithGrade > 0 ? (total / countWithGrade).toFixed(1) : "-";
                            return `
                                <tr>
                                    <td class="text-left" style="font-weight: 600;">${student.name}</td>
                                    ${examGrades.map(g => `<td style="color: ${g === '-' ? '#94a3b8' : '#1e293b'}; font-weight: ${g === '-' ? 'normal' : '600'};">${g}</td>`).join('')}
                                    <td style="font-weight: bold; background: #eef2ff; color: #4338ca;">${avg}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                ` : `
                <div style="padding: 12px; border: 1px dashed #cbd5e1; border-radius: 6px; text-align: center; color: #64748b; font-style: italic; margin-top: 10px;">
                    No se han registrado exámenes en este periodo.
                </div>
                `}

                <div class="signature-container">
                    <div class="signature-box">
                        <div style="height: 45px;"></div>
                        <div style="border-top: 1px solid #94a3b8; padding-top: 5px;">
                            <p style="margin: 0; font-weight: bold; color: #1e293b; font-size: 9pt;">Freddy Samario Reyes</p>
                            <p style="margin: 2px 0 0 0; color: #64748b; font-size: 8pt;">Nombre y Firma del Docente</p>
                        </div>
                    </div>
                </div>

                <div class="page-break"></div>
                <h2 class="sub-heading">Lista de Actividades Desarrolladas</h2>
                <table>
                    <thead>
                        <tr style="background: #f8fafc;">
                            <th style="width: 40px;">#</th>
                            <th class="text-left">Nombre de la Actividad</th>
                            <th class="text-left">Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${activityList.map(a => `
                            <tr>
                                <td style="font-weight: 600;">${a.num}</td>
                                <td class="text-left">${a.name}</td>
                                <td class="text-left" style="color: #64748b;">${a.date}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                ${examList.length > 0 ? `
                <h2 class="sub-heading" style="margin-top: 25px; border-bottom-color: #4f46e5; color: #312e81;">Lista de Exámenes Registrados</h2>
                <table>
                    <thead>
                        <tr style="background: #eef2ff;">
                            <th style="width: 40px;">#</th>
                            <th class="text-left">Nombre del Examen</th>
                            <th class="text-left">Fecha</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${examList.map(e => `
                            <tr>
                                <td style="font-weight: 600; color: #4338ca;">${e.num}</td>
                                <td class="text-left" style="font-weight: 600;">${e.name}</td>
                                <td class="text-left" style="color: #64748b;">${e.date}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}

                <div class="signature-container">
                    <div class="signature-box">
                        <div style="height: 45px;"></div>
                        <div style="border-top: 1px solid #94a3b8; padding-top: 5px;">
                            <p style="margin: 0; font-weight: bold; color: #1e293b; font-size: 9pt;">Freddy Samario Reyes</p>
                            <p style="margin: 2px 0 0 0; color: #64748b; font-size: 8pt;">Nombre y Firma del Docente</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    execPrint(html, filename = 'Reporte.pdf') {
        const cleanName = (filename || 'Reporte.pdf').replace(/[\\/:*?"<>|]/g, '_');
        const finalTitle = cleanName.toLowerCase().endsWith('.pdf') ? cleanName : `${cleanName}.pdf`;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            this.showToast("Por favor permite ventanas emergentes (pop-ups) en tu navegador.", "error");
            return;
        }

        printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>${finalTitle}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 6mm 8mm;
        }
        @media print {
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            html, body {
                margin: 0;
                padding: 0;
                background: #ffffff;
            }
            .page-break {
                page-break-after: always !important;
                break-after: page !important;
            }
            .pdf-page {
                page-break-after: always !important;
                break-after: page !important;
            }
        }
        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: Arial, sans-serif;
        }
    </style>
</head>
<body>
    ${html}
</body>
</html>`);
        printWindow.document.close();
        printWindow.focus();

        const triggerPrint = () => {
            try {
                printWindow.focus();
                printWindow.print();
            } catch (e) {
                console.error("Print error:", e);
            }
        };

        // Esperar a que las imágenes (código QR) terminen de renderizarse antes de imprimir
        const imgs = Array.from(printWindow.document.images || []);
        if (imgs.length === 0) {
            setTimeout(triggerPrint, 350);
        } else {
            let loaded = 0;
            const onDone = () => {
                loaded++;
                if (loaded >= imgs.length) {
                    setTimeout(triggerPrint, 250);
                }
            };
            imgs.forEach(img => {
                if (img.complete && img.naturalHeight !== 0) {
                    onDone();
                } else {
                    img.onload = onDone;
                    img.onerror = onDone;
                }
            });
            setTimeout(triggerPrint, 1200);
        }
    },

    execDownload(html, filename) {
        this.execPrint(html, filename);
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
