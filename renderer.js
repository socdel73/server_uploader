const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { ipcRenderer } = require('electron');

const activityOut = document.getElementById('activityOut');
const out = document.getElementById('out');
const selLogs = document.getElementById('selLogs');
const btnRefreshLogs = document.getElementById('btnRefreshLogs');
const btnOpenLogsFolder = document.getElementById('btnOpenLogsFolder');
const btnViewLogRaw = document.getElementById('btnViewLogRaw');
const btn = document.getElementById('btnTest');

const profileSelect = document.getElementById('profileSelect');
const activeProfileLabel = document.getElementById('activeProfileLabel');
const remoteDirInput = document.getElementById('remoteDirInput');
const remoteDirDefaultLabel = document.getElementById('remoteDirDefaultLabel');
const remoteDirBaseDefaultLabel = document.getElementById('remoteDirBaseDefaultLabel');
const remoteRootSelect = document.getElementById('remoteRootSelect');
const btnUseRemoteRoot = document.getElementById('btnUseRemoteRoot');
const btnFetchRemoteDirs = document.getElementById('btnFetchRemoteDirs');
const remoteDirList = document.getElementById('remoteDirList');
const btnUseRemoteDir = document.getElementById('btnUseRemoteDir');
const remoteDirHint = document.getElementById('remoteDirHint');
const newSubfolderInput = document.getElementById('newSubfolderInput');
const btnComposeRemote = document.getElementById('btnComposeRemote');
const remoteRootInput = document.getElementById('remoteRootInput');
const btnAddRemoteRoot = document.getElementById('btnAddRemoteRoot');
const btnRemoveRemoteRoot = document.getElementById('btnRemoveRemoteRoot');
const btnResetRemoteRoots = document.getElementById('btnResetRemoteRoots');
const remoteRootsHint = document.getElementById('remoteRootsHint');
const uploadsList = document.getElementById('uploadsList');
const btnCancelUpload = document.getElementById('btnCancelUpload');
const chkDeleteOnCancel = document.getElementById('chkDeleteOnCancel');
const langButtons = Array.from(document.querySelectorAll('[data-lang]'));

let activeProfileName = null;
let activeProfile = null;
let configCache = null;
let currentLanguage = 'ca';

const I18N = {
  ca: {
    'hero.badge': 'Utilitat local',
    'hero.title': 'Server Uploader',
    'hero.copy': "Pujador d'escriptori per enviar fitxers i carpetes a servidors remots amb perfils, destins assistits, cua visual i logs locals.",
    'profile.title': 'Perfil actiu',
    'profile.copy': 'Selecciona servidor, revisa el perfil carregat i prova la connexió abans de pujar.',
    'profile.label': 'Perfil',
    'profile.active': 'Actiu',
    'profile.using': '→ {name}',
    'remote.title': 'Desti remot',
    'remote.copy': 'Tria la base de desti, llista subdirectoris i, si cal, afegeix una subcarpeta nova per construir el desti final.',
    'remote.baseTitle': 'Desti remot',
    'remote.dirLabel': 'Remote dir',
    'remote.exampleLabel': 'Exemple:',
    'remote.defaultLabel': 'Per defecte:',
    'remote.notSet': '(no configurat)',
    'assistant.title': 'Assistent de desti',
    'assistant.copy': "Llista directoris remots i construeix el cami final sense haver-lo d'escriure a ma.",
    'assistant.summary': 'Bases, carpetes i composicio guiada',
    'assistant.base': 'Base',
    'assistant.list': 'Llistar',
    'assistant.subfolder': 'Subdirectori existent',
    'assistant.chooseListed': '(tria una carpeta llistada)',
    'assistant.use': 'Usa',
    'assistant.newSubfolder': 'Subcarpeta nova',
    'assistant.newSubfolderPlaceholder': 'ex: projecte_X',
    'assistant.compose': 'Construeix cami',
    'assistant.hint': 'Llista nomes directoris (nivell 2) dins la base seleccionada.',
    'assistant.loading': '(carregant...)',
    'assistant.empty': '(sense resultats)',
    'assistant.listedCount': 'Llistat {count} directoris sota {root}',
    'assistant.selectBaseFirst': 'Selecciona una base o carpeta llistada primer.',
    'assistant.baseMissing': 'La base {root} encara no existeix al servidor. Pots continuar i es crearà quan facis l’upload.',
    'roots.title': 'Bases remotes del perfil',
    'roots.copy': 'Afegeix bases segures per aquest perfil, elimina les que no calguin o torna al valor original del config.',
    'roots.newLabel': 'Nova base remota',
    'roots.newPlaceholder': '/srv/www/client',
    'roots.savedLabel': 'Bases guardades',
    'roots.add': 'Afegir base',
    'roots.use': 'Usa base',
    'roots.remove': 'Eliminar',
    'roots.reset': 'Reset bases',
    'roots.hint': "Només es permeten rutes de treball segures. Mai no s'oferiran directoris crítics del servidor.",
    'roots.defaultOption': '(tria una base guardada)',
    'roots.added': 'Base remota afegida: {path}',
    'roots.removed': 'Base remota eliminada: {path}',
    'roots.resetDone': 'Bases remotes restaurades al valor del perfil.',
    'roots.emptyInput': 'Escriu una ruta base abans d’afegir-la.',
    'roots.duplicate': 'Aquesta base ja existeix en el perfil.',
    'roots.invalid': 'Ruta base no vàlida. Ha de començar per / i no pot contenir espais finals.',
    'roots.blocked': 'Ruta bloquejada per seguretat. No es poden oferir directoris crítics del servidor.',
    'roots.noneSaved': '(no hi ha bases guardades)',
    'actions.title': 'Accions',
    'actions.copy': 'Tria si vols comprovar connexio, pujar fitxers solts o sincronitzar una carpeta.',
    'actions.test': 'Test connection',
    'actions.uploadFiles': 'Upload file(s)',
    'actions.uploadFolder': 'Upload folder',
    'actions.cancel': 'Cancella upload',
    'actions.deleteOnCancel': 'Esborra remot si es cancella',
    'uploads.title': 'Uploads',
    'uploads.hint': 'Cada upload apareix com una targeta.',
    'uploads.activityTitle': 'Activitat actual',
    'uploads.activityCopy': "Sortida viva de la sessió actual, proves de connexió i missatges d'estat.",
    'uploads.queueTitle': "Cua d'uploads",
    'uploads.queueCopy': "Targetes de progrés i estat de cada fitxer o carpeta que està passant per la cua.",
    'uploads.queued': 'cua',
    'uploads.uploading': 'pujant',
    'uploads.done': 'fet',
    'uploads.error': 'error',
    'uploads.cancelling': 'cancel·lant',
    'uploads.folderTitle': 'carpeta — {name}',
    'uploads.fileTitle': '{index}/{total} — {name}',
    'logs.title': 'Logs',
    'logs.copy': 'Consulta sessions anteriors o obre la carpeta local de logs.',
    'logs.refresh': 'Refresca',
    'logs.viewRaw': 'Veure brut',
    'logs.openFolder': 'Carpeta logs',
    'logs.none': '(sense logs)',
    'status.noLogSelected': 'No hi ha cap log seleccionat',
    'status.logReadError': 'ERROR llegint log: {error}',
    'status.configLoaded': 'Config loaded',
    'status.configLoading': 'Loading config...',
    'status.configLoadError': 'ERROR loading config',
    'status.activeProfile': 'Perfil actiu: {name}',
    'status.host': 'Host: {host}',
    'status.sshRunning': "Executant prova d'SSH...",
    'status.result': '--- RESULT ---',
    'status.errorHeader': '--- ERROR ---',
    'status.profileChanged': 'Perfil canviat a: {name}',
    'status.remoteSelected': 'Remote dir seleccionat: {path}',
    'status.remoteSet': 'Remote dir establert: {path}',
    'status.logsRefreshed': 'Logs refreshed',
    'status.logsOpened': 'Carpeta de logs oberta: {path}',
    'status.logsOpenError': 'ERROR obrint carpeta de logs: {error}',
    'status.logsRefreshError': 'ERROR refrescant logs: {error}',
    'status.uploadCancelled': 'Upload cancel·lat',
    'status.uploadFolderCancelled': 'Upload de carpeta cancel·lat',
    'status.noValidFiles': "No hi ha fitxers valids seleccionats (s'han filtrat els fitxers metadata de macOS).",
    'status.remoteDirMissing': 'Remote dir no configurat. Escriu una ruta de servidor com /srv/storage-media/uploads_test.',
    'status.ensuringRemoteDir': 'Assegurant que existeix el directori remot...',
    'status.remoteDir': 'Remote dir: {path}',
    'status.filesSelected': 'Fitxers seleccionats: {count}',
    'status.uploadingFile': 'Pujant ({index}/{total}): {path}',
    'status.uploadingFolder': 'Pujant carpeta: {path}',
    'status.uploadingFolderRsync': 'Pujant carpeta via rsync (SSH)...',
    'status.resultLine': 'Resultat: {result}',
    'status.allUploadsFinished': 'Tots els uploads han acabat.',
    'status.folderUploadFinished': "L'upload de carpeta ha acabat.",
    'status.finishedWithErrors': 'Acabat amb errors: {failed}/{total}',
    'status.logSaved': 'Log desat: {path}',
    'status.noUploadsRunning': 'No hi ha cap upload en curs',
    'status.cancellingUploads': 'Cancel·lant {count} upload(s) en curs...',
    'status.remoteDeleted': 'Remot esborrat ({id}): {result}',
    'status.remoteDeleteError': 'ERROR esborrant remot ({id}): {error}',
    'status.openedLogsFolder': 'Opened logs folder: {path}',
    'errors.remotePermissionDenied': 'Permís denegat al servidor per crear o escriure a {path}. Tria una ruta on l’usuari SSH tingui permisos, per exemple dins d’una base del perfil.',
    'errors.remoteNotDirectory': 'La ruta remota existeix però no és una carpeta: {path}',
  },
  es: {
    'hero.badge': 'Utilidad local',
    'hero.title': 'Server Uploader',
    'hero.copy': 'Subidor de escritorio para enviar archivos y carpetas a servidores remotos con perfiles, destinos asistidos, cola visual y logs locales.',
    'profile.title': 'Perfil activo',
    'profile.copy': 'Selecciona servidor, revisa el perfil cargado y prueba la conexión antes de subir.',
    'profile.label': 'Perfil',
    'profile.active': 'Activo',
    'profile.using': '→ {name}',
    'remote.title': 'Destino remoto',
    'remote.copy': 'Elige la base de destino, lista subdirectorios y, si hace falta, añade una subcarpeta nueva para construir el destino final.',
    'remote.baseTitle': 'Destino remoto',
    'remote.dirLabel': 'Remote dir',
    'remote.exampleLabel': 'Ejemplo:',
    'remote.defaultLabel': 'Por defecto:',
    'remote.notSet': '(sin configurar)',
    'assistant.title': 'Asistente de destino',
    'assistant.copy': 'Lista directorios remotos y construye la ruta final sin tener que escribirla a mano.',
    'assistant.summary': 'Bases, carpetas y composición guiada',
    'assistant.base': 'Base',
    'assistant.list': 'Listar',
    'assistant.subfolder': 'Subdirectorio existente',
    'assistant.chooseListed': '(elige una carpeta listada)',
    'assistant.use': 'Usar',
    'assistant.newSubfolder': 'Subcarpeta nueva',
    'assistant.newSubfolderPlaceholder': 'ej: proyecto_X',
    'assistant.compose': 'Construir ruta',
    'assistant.hint': 'Lista solo directorios (nivel 2) dentro de la base seleccionada.',
    'assistant.loading': '(cargando...)',
    'assistant.empty': '(sin resultados)',
    'assistant.listedCount': 'Listado {count} directorios bajo {root}',
    'assistant.selectBaseFirst': 'Selecciona primero una base o carpeta listada.',
    'assistant.baseMissing': 'La base {root} todavía no existe en el servidor. Puedes continuar y se creará cuando hagas el upload.',
    'roots.title': 'Bases remotas del perfil',
    'roots.copy': 'Añade bases seguras para este perfil, elimina las que no hagan falta o vuelve al valor original del config.',
    'roots.newLabel': 'Nueva base remota',
    'roots.newPlaceholder': '/srv/www/client',
    'roots.savedLabel': 'Bases guardadas',
    'roots.add': 'Añadir base',
    'roots.use': 'Usar base',
    'roots.remove': 'Eliminar',
    'roots.reset': 'Reset bases',
    'roots.hint': 'Solo se permiten rutas de trabajo seguras. Nunca se ofrecerán directorios críticos del servidor.',
    'roots.defaultOption': '(elige una base guardada)',
    'roots.added': 'Base remota añadida: {path}',
    'roots.removed': 'Base remota eliminada: {path}',
    'roots.resetDone': 'Bases remotas restauradas al valor del perfil.',
    'roots.emptyInput': 'Escribe una ruta base antes de añadirla.',
    'roots.duplicate': 'Esta base ya existe en el perfil.',
    'roots.invalid': 'Ruta base no válida. Debe empezar por / y no puede contener espacios finales.',
    'roots.blocked': 'Ruta bloqueada por seguridad. No se pueden ofrecer directorios críticos del servidor.',
    'roots.noneSaved': '(no hay bases guardadas)',
    'actions.title': 'Acciones',
    'actions.copy': 'Elige si quieres comprobar la conexión, subir archivos sueltos o sincronizar una carpeta.',
    'actions.test': 'Probar conexión',
    'actions.uploadFiles': 'Subir archivo(s)',
    'actions.uploadFolder': 'Subir carpeta',
    'actions.cancel': 'Cancelar upload',
    'actions.deleteOnCancel': 'Borrar remoto si se cancela',
    'uploads.title': 'Uploads',
    'uploads.hint': 'Cada upload aparece como una tarjeta.',
    'uploads.activityTitle': 'Actividad actual',
    'uploads.activityCopy': 'Salida viva de la sesión actual, pruebas de conexión y mensajes de estado.',
    'uploads.queueTitle': 'Cola de uploads',
    'uploads.queueCopy': 'Tarjetas de progreso y estado de cada archivo o carpeta que pasa por la cola.',
    'uploads.queued': 'cola',
    'uploads.uploading': 'subiendo',
    'uploads.done': 'hecho',
    'uploads.error': 'error',
    'uploads.cancelling': 'cancelando',
    'uploads.folderTitle': 'carpeta — {name}',
    'uploads.fileTitle': '{index}/{total} — {name}',
    'logs.title': 'Logs',
    'logs.copy': 'Consulta sesiones anteriores o abre la carpeta local de logs.',
    'logs.refresh': 'Refrescar',
    'logs.viewRaw': 'Ver bruto',
    'logs.openFolder': 'Carpeta logs',
    'logs.none': '(sin logs)',
    'status.noLogSelected': 'No hay ningún log seleccionado',
    'status.logReadError': 'ERROR leyendo log: {error}',
    'status.configLoaded': 'Config loaded',
    'status.configLoading': 'Loading config...',
    'status.configLoadError': 'ERROR loading config',
    'status.activeProfile': 'Perfil activo: {name}',
    'status.host': 'Host: {host}',
    'status.sshRunning': 'Ejecutando prueba de SSH...',
    'status.result': '--- RESULT ---',
    'status.errorHeader': '--- ERROR ---',
    'status.profileChanged': 'Perfil cambiado a: {name}',
    'status.remoteSelected': 'Remote dir seleccionado: {path}',
    'status.remoteSet': 'Remote dir establecido: {path}',
    'status.logsRefreshed': 'Logs refreshed',
    'status.logsOpened': 'Carpeta de logs abierta: {path}',
    'status.logsOpenError': 'ERROR abriendo carpeta de logs: {error}',
    'status.logsRefreshError': 'ERROR refrescando logs: {error}',
    'status.uploadCancelled': 'Upload cancelado',
    'status.uploadFolderCancelled': 'Upload de carpeta cancelado',
    'status.noValidFiles': 'No hay archivos válidos seleccionados (se han filtrado los archivos metadata de macOS).',
    'status.remoteDirMissing': 'Remote dir no configurado. Escribe una ruta de servidor como /srv/storage-media/uploads_test.',
    'status.ensuringRemoteDir': 'Asegurando que exista el directorio remoto...',
    'status.remoteDir': 'Remote dir: {path}',
    'status.filesSelected': 'Archivos seleccionados: {count}',
    'status.uploadingFile': 'Subiendo ({index}/{total}): {path}',
    'status.uploadingFolder': 'Subiendo carpeta: {path}',
    'status.uploadingFolderRsync': 'Subiendo carpeta vía rsync (SSH)...',
    'status.resultLine': 'Resultado: {result}',
    'status.allUploadsFinished': 'Todos los uploads han terminado.',
    'status.folderUploadFinished': 'La subida de carpeta ha terminado.',
    'status.finishedWithErrors': 'Terminado con errores: {failed}/{total}',
    'status.logSaved': 'Log guardado: {path}',
    'status.noUploadsRunning': 'No hay uploads en curso',
    'status.cancellingUploads': 'Cancelando {count} upload(s) en curso...',
    'status.remoteDeleted': 'Remoto borrado ({id}): {result}',
    'status.remoteDeleteError': 'ERROR borrando remoto ({id}): {error}',
    'status.openedLogsFolder': 'Opened logs folder: {path}',
    'errors.remotePermissionDenied': 'Permiso denegado en el servidor para crear o escribir en {path}. Elige una ruta donde el usuario SSH tenga permisos, por ejemplo dentro de una base del perfil.',
    'errors.remoteNotDirectory': 'La ruta remota existe pero no es una carpeta: {path}',
  },
  en: {
    'hero.badge': 'Local utility',
    'hero.title': 'Server Uploader',
    'hero.copy': 'Desktop uploader for sending files and folders to remote servers with profiles, assisted destinations, a visual queue, and local logs.',
    'profile.title': 'Active profile',
    'profile.copy': 'Select a server, review the loaded profile, and test the connection before uploading.',
    'profile.label': 'Profile',
    'profile.active': 'Active',
    'profile.using': '→ {name}',
    'remote.title': 'Remote destination',
    'remote.copy': 'Choose the destination base, list subdirectories, and optionally add a new subfolder to build the final destination.',
    'remote.baseTitle': 'Remote destination',
    'remote.dirLabel': 'Remote dir',
    'remote.exampleLabel': 'Example:',
    'remote.defaultLabel': 'Default:',
    'remote.notSet': '(not set)',
    'assistant.title': 'Destination assistant',
    'assistant.copy': 'List remote directories and build the final path without typing it by hand.',
    'assistant.summary': 'Bases, folders, and guided composition',
    'assistant.base': 'Base',
    'assistant.list': 'List',
    'assistant.subfolder': 'Existing subdirectory',
    'assistant.chooseListed': '(choose a listed folder)',
    'assistant.use': 'Use',
    'assistant.newSubfolder': 'New subfolder',
    'assistant.newSubfolderPlaceholder': 'e.g. project_X',
    'assistant.compose': 'Build path',
    'assistant.hint': 'Only lists directories (depth 2) inside the selected base.',
    'assistant.loading': '(loading...)',
    'assistant.empty': '(no results)',
    'assistant.listedCount': 'Listed {count} directories under {root}',
    'assistant.selectBaseFirst': 'Pick a base or listed folder first.',
    'assistant.baseMissing': 'The base {root} does not exist on the server yet. You can continue and it will be created when you upload.',
    'roots.title': 'Profile remote bases',
    'roots.copy': 'Add safe bases for this profile, remove the ones you no longer need, or restore the original config value.',
    'roots.newLabel': 'New remote base',
    'roots.newPlaceholder': '/srv/www/client',
    'roots.savedLabel': 'Saved bases',
    'roots.add': 'Add base',
    'roots.use': 'Use base',
    'roots.remove': 'Remove',
    'roots.reset': 'Reset bases',
    'roots.hint': 'Only safe working paths are allowed. Critical server directories are never offered.',
    'roots.defaultOption': '(choose a saved base)',
    'roots.added': 'Remote base added: {path}',
    'roots.removed': 'Remote base removed: {path}',
    'roots.resetDone': 'Remote bases restored to the profile defaults.',
    'roots.emptyInput': 'Enter a base path before adding it.',
    'roots.duplicate': 'That base already exists in this profile.',
    'roots.invalid': 'Invalid base path. It must start with / and cannot contain trailing spaces.',
    'roots.blocked': 'Path blocked for safety. Critical server directories cannot be offered.',
    'roots.noneSaved': '(no saved bases)',
    'actions.title': 'Actions',
    'actions.copy': 'Choose whether to test the connection, upload files, or sync a folder.',
    'actions.test': 'Test connection',
    'actions.uploadFiles': 'Upload file(s)',
    'actions.uploadFolder': 'Upload folder',
    'actions.cancel': 'Cancel upload',
    'actions.deleteOnCancel': 'Delete remote path on cancel',
    'uploads.title': 'Uploads',
    'uploads.hint': 'Each upload appears as a card.',
    'uploads.activityTitle': 'Current activity',
    'uploads.activityCopy': 'Live output for the current session, connection checks, and status messages.',
    'uploads.queueTitle': 'Upload queue',
    'uploads.queueCopy': 'Progress cards and status for each file or folder moving through the queue.',
    'uploads.queued': 'queued',
    'uploads.uploading': 'uploading',
    'uploads.done': 'done',
    'uploads.error': 'error',
    'uploads.cancelling': 'cancelling',
    'uploads.folderTitle': 'folder — {name}',
    'uploads.fileTitle': '{index}/{total} — {name}',
    'logs.title': 'Logs',
    'logs.copy': 'Review previous sessions or open the local logs folder.',
    'logs.refresh': 'Refresh',
    'logs.viewRaw': 'View raw',
    'logs.openFolder': 'Logs folder',
    'logs.none': '(no logs)',
    'status.noLogSelected': 'No log selected',
    'status.logReadError': 'ERROR reading log: {error}',
    'status.configLoaded': 'Config loaded',
    'status.configLoading': 'Loading config...',
    'status.configLoadError': 'ERROR loading config',
    'status.activeProfile': 'Active profile: {name}',
    'status.host': 'Host: {host}',
    'status.sshRunning': 'Running SSH test...',
    'status.result': '--- RESULT ---',
    'status.errorHeader': '--- ERROR ---',
    'status.profileChanged': 'Profile changed to: {name}',
    'status.remoteSelected': 'Remote dir selected: {path}',
    'status.remoteSet': 'Remote dir set: {path}',
    'status.logsRefreshed': 'Logs refreshed',
    'status.logsOpened': 'Opened logs folder: {path}',
    'status.logsOpenError': 'ERROR opening logs folder: {error}',
    'status.logsRefreshError': 'ERROR refreshing logs: {error}',
    'status.uploadCancelled': 'Upload cancelled',
    'status.uploadFolderCancelled': 'Folder upload cancelled',
    'status.noValidFiles': 'No valid files selected (macOS metadata files were filtered out).',
    'status.remoteDirMissing': 'Remote dir not set. Enter a server path like /srv/storage-media/uploads_test.',
    'status.ensuringRemoteDir': 'Ensuring remote dir exists...',
    'status.remoteDir': 'Remote dir: {path}',
    'status.filesSelected': 'Files selected: {count}',
    'status.uploadingFile': 'Uploading ({index}/{total}): {path}',
    'status.uploadingFolder': 'Uploading folder: {path}',
    'status.uploadingFolderRsync': 'Uploading folder via rsync (SSH)...',
    'status.resultLine': 'Result: {result}',
    'status.allUploadsFinished': 'All uploads finished.',
    'status.folderUploadFinished': 'Folder upload finished.',
    'status.finishedWithErrors': 'Finished with errors: {failed}/{total}',
    'status.logSaved': 'Log saved: {path}',
    'status.noUploadsRunning': 'No uploads are currently running',
    'status.cancellingUploads': 'Cancelling {count} active upload(s)...',
    'status.remoteDeleted': 'Remote deleted ({id}): {result}',
    'status.remoteDeleteError': 'ERROR deleting remote ({id}): {error}',
    'status.openedLogsFolder': 'Opened logs folder: {path}',
    'errors.remotePermissionDenied': 'Permission denied on the server when creating or writing to {path}. Choose a path the SSH user can write to, for example inside one of the profile bases.',
    'errors.remoteNotDirectory': 'The remote path exists but is not a directory: {path}',
  },
};

// Remote dir override per profile (in-memory)
const remoteDirByProfile = {};
const remoteRootsByProfile = {};
// Track active uploads (supports parallel uploads)
const activeUploads = new Map(); // uploadId -> { proc, remoteTarget, profile }
let colorIndex = 0;
const COLOR_COUNT = 6;

// Session log file (one per user action)
let currentLogFile = null;

function getStoredLanguage() {
  try {
    const saved = window.localStorage.getItem('server_uploader.language');
    if (saved && I18N[saved]) return saved;
  } catch (_) {
    // ignore localStorage issues
  }
  return 'ca';
}

function setStoredLanguage(lang) {
  try {
    window.localStorage.setItem('server_uploader.language', lang);
  } catch (_) {
    // ignore localStorage issues
  }
}

function t(key, vars = {}) {
  const table = I18N[currentLanguage] || I18N.ca;
  const fallback = I18N.ca[key] || key;
  const template = table[key] || fallback;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
}

function translateStatus(status) {
  const statusKeyMap = {
    queued: 'uploads.queued',
    uploading: 'uploads.uploading',
    done: 'uploads.done',
    error: 'uploads.error',
    cancelling: 'uploads.cancelling',
  };
  return statusKeyMap[status] ? t(statusKeyMap[status]) : status;
}

function formatAppError(err, context = {}) {
  const message = String(err?.message || err || '');
  const targetPath = context.path || remoteDirInput?.value?.trim() || '';

  if (/Remote path exists but is not a directory:/i.test(message)) {
    const pathMatch = message.match(/Remote path exists but is not a directory:\s*(.+)$/i);
    return t('errors.remoteNotDirectory', { path: pathMatch?.[1] || targetPath || '?' });
  }

  if (/Permission denied/i.test(message) && (/ensureRemoteDir/i.test(message) || /mkdir:/i.test(message) || /rsync exit/i.test(message))) {
    return t('errors.remotePermissionDenied', { path: targetPath || '?' });
  }

  return message;
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });

  if (activeProfileLabel) {
    activeProfileLabel.textContent = t('profile.using', { name: activeProfileName || '-' });
  }

  if (remoteDirDefaultLabel && configCache) {
    const name = activeProfileName || profileSelect.value || configCache.defaultProfile;
    const profileDefault = (configCache.profiles[name] && configCache.profiles[name].remoteDirDefault) || '';
    const globalDefault = configCache.remoteDirDefault || '';
    const resolvedDefault = profileDefault || globalDefault || t('remote.notSet');
    remoteDirDefaultLabel.textContent = resolvedDefault;
    if (remoteDirBaseDefaultLabel) {
      remoteDirBaseDefaultLabel.textContent = resolvedDefault;
    }
  }

  if (remoteDirList && !remoteDirList.options.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = t('assistant.chooseListed');
    remoteDirList.appendChild(opt);
  }

  if (selLogs && !selLogs.options.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = t('logs.none');
    selLogs.appendChild(opt);
  }

  langButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.lang === currentLanguage);
  });

  uploadsList?.querySelectorAll('.upload-row').forEach((row) => {
    const statusNode = row.querySelector('[data-role="status"]');
    if (statusNode?.dataset.statusKey) {
      statusNode.textContent = translateStatus(statusNode.dataset.statusKey);
    }
  });
}

function setLanguage(lang) {
  if (!I18N[lang]) return;
  currentLanguage = lang;
  setStoredLanguage(lang);
  applyTranslations();
}

function getProfileRootsStorage() {
  try {
    const raw = window.localStorage.getItem('server_uploader.remoteRootsByProfile');
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function setProfileRootsStorage(data) {
  try {
    window.localStorage.setItem('server_uploader.remoteRootsByProfile', JSON.stringify(data));
  } catch (_) {
    // ignore localStorage issues
  }
}

function normalizeRemotePath(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('/')) return '';
  if (/[\r\n\t]/.test(trimmed)) return '';
  if (trimmed.includes('/../') || trimmed.endsWith('/..') || trimmed === '/..') return '';
  return trimmed.replace(/\/+$/, '') || '/';
}

function isCriticalRemotePath(remotePath) {
  const blockedExact = new Set([
    '/',
    '/bin',
    '/boot',
    '/dev',
    '/etc',
    '/home',
    '/lib',
    '/lib64',
    '/proc',
    '/root',
    '/run',
    '/sbin',
    '/sys',
    '/tmp',
    '/usr',
    '/var',
  ]);

  const blockedPrefixes = [
    '/boot/',
    '/dev/',
    '/etc/',
    '/lib/',
    '/lib64/',
    '/proc/',
    '/root/',
    '/run/',
    '/sbin/',
    '/sys/',
    '/usr/',
    '/var/lib/',
    '/var/log/',
    '/var/run/',
    '/var/spool/',
  ];

  if (blockedExact.has(remotePath)) return true;
  return blockedPrefixes.some((prefix) => remotePath.startsWith(prefix));
}

function getConfigRootsForProfile(name) {
  const roots = configCache?.profiles?.[name]?.remoteRoots || configCache?.remoteRoots || ['/srv/storage-media', '/srv/storage-2md'];
  return Array.from(new Set(roots.map(normalizeRemotePath).filter((root) => root && !isCriticalRemotePath(root))));
}

function getUserRootsForProfile(name) {
  const storage = getProfileRootsStorage();
  const roots = Array.isArray(storage[name]) ? storage[name] : null;
  return roots ? roots.map(normalizeRemotePath).filter((root) => root && !isCriticalRemotePath(root)) : null;
}

function getEffectiveRootsForProfile(name) {
  return getUserRootsForProfile(name) || getConfigRootsForProfile(name);
}

function persistRootsForProfile(name, roots) {
  const storage = getProfileRootsStorage();
  storage[name] = Array.from(new Set(roots.map(normalizeRemotePath).filter((root) => root && !isCriticalRemotePath(root))));
  setProfileRootsStorage(storage);
}

function resetPersistedRootsForProfile(name) {
  const storage = getProfileRootsStorage();
  delete storage[name];
  setProfileRootsStorage(storage);
}

function ensureLogsDir() {
  const dir = path.join(os.homedir(), '.config', 'server_uploader', 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function listLocalLogs() {
  const dir = ensureLogsDir();
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.log'))
    .map((f) => ({
      name: f,
      full: path.join(dir, f),
      mtime: fs.statSync(path.join(dir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime); // newest first
  return files;
}

function refreshLogsSelect() {
  if (!selLogs) return;
  const logs = listLocalLogs();
  selLogs.innerHTML = '';

  if (!logs.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = t('logs.none');
    selLogs.appendChild(opt);
    return;
  }

  for (const l of logs) {
    const opt = document.createElement('option');
    opt.value = l.full;
    opt.textContent = l.name;
    selLogs.appendChild(opt);
  }

  // Keep current selection if possible
  if (currentLogFile && logs.some((l) => l.full === currentLogFile)) {
    selLogs.value = currentLogFile;
  }
}

function viewSelectedLogRaw() {
  if (!selLogs || !out) return;
  const p = selLogs.value;
  if (!p) {
    log(t('status.noLogSelected'));
    return;
  }
  try {
    const raw = fs.readFileSync(p, 'utf8');
    out.textContent = raw;
  } catch (err) {
    log(t('status.logReadError', { error: String(err.message || err) }));
  }
}

function tsForFilename(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function startLogSession(kind) {
  const dir = ensureLogsDir();
  currentLogFile = path.join(dir, `${tsForFilename()}_${kind}.log`);
  fs.writeFileSync(currentLogFile, `# server_uploader log\n# kind: ${kind}\n# started: ${new Date().toISOString()}\n\n`, 'utf8');
  refreshLogsSelect();
  return currentLogFile;
}

function log(line) {
  if (!activityOut) {
    console.log(line);
    return;
  }
  activityOut.textContent += line + '\n';
  if (currentLogFile) {
    try {
      fs.appendFileSync(currentLogFile, line + '\n', 'utf8');
    } catch (_) {
      // ignore log write errors
    }
  }
}

function bytesToHuman(bytes) {
  if (!Number.isFinite(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const decimals = i === 0 ? 0 : (i === 1 ? 1 : 2);
  return `${v.toFixed(decimals)} ${units[i]}`;
}

function humanToBytes(token) {
  // Accept formats like: "12345", "12,345,678", "412.34M", "412.34MB", "11.2KB", "1.1GB"
  if (!token) return 0;
  const t = token.trim();
  const plain = t.replace(/,/g, '');
  const m = plain.match(/^(\d+(?:\.\d+)?)([KMGTP]?)(B)?$/i);
  if (!m) return 0;
  const num = Number(m[1]);
  const unit = (m[2] || '').toUpperCase();
  const mult = unit === 'K' ? 1024 : unit === 'M' ? 1024 ** 2 : unit === 'G' ? 1024 ** 3 : unit === 'T' ? 1024 ** 4 : 1;
  return Math.round(num * mult);
}


function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function makeUploadId(prefix = 'u') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createUploadRow({ uploadId, title, totalBytes, remoteDir }) {
  if (!uploadsList) return null;

  const row = document.createElement('div');
  row.className = 'upload-row';
  row.dataset.uploadId = uploadId;
  row.dataset.color = String(colorIndex % COLOR_COUNT);
  colorIndex += 1;

  const totalText = totalBytes > 0 ? bytesToHuman(totalBytes) : '—';

  row.innerHTML = `
    <div class="upload-grid">
      <div class="upload-label" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
      <div class="mono" data-role="xfer">0 B / ${escapeHtml(totalText)}</div>
      <div class="mono" title="${escapeHtml(remoteDir || '')}">${escapeHtml(remoteDir || '')}</div>
      <div><span class="badge" data-role="status" data-status-key="queued">${escapeHtml(t('uploads.queued'))}</span></div>
    </div>

    <div class="progress-wrap">
      <div class="progress-bar" data-role="bar" style="width:0%"></div>
    </div>

    <div class="mono" style="margin-top:8px; opacity:.85;" data-role="meta">0% • – • –</div>
  `;

  uploadsList.appendChild(row);
  return row;
}

function updateUploadRow(uploadId, { transferredBytes, totalBytes, percent, speed, eta, status }) {
  if (!uploadsList) return;
  const row = uploadsList.querySelector(`.upload-row[data-upload-id="${uploadId}"]`);
  if (!row) return;

  const bar = row.querySelector('[data-role="bar"]');
  const xfer = row.querySelector('[data-role="xfer"]');
  const meta = row.querySelector('[data-role="meta"]');
  const st = row.querySelector('[data-role="status"]');

  const pct = Number.isFinite(percent)
    ? Math.min(100, Math.max(0, Math.round(percent)))
    : (totalBytes > 0 && Number.isFinite(transferredBytes)
      ? Math.min(100, Math.max(0, Math.round((transferredBytes / totalBytes) * 100)))
      : 0);

  if (bar) bar.style.width = `${pct}%`;

  const totalText = totalBytes > 0 ? bytesToHuman(totalBytes) : '—';
  const xferText = Number.isFinite(transferredBytes) ? bytesToHuman(transferredBytes) : '0 B';
  if (xfer) xfer.textContent = `${xferText} / ${totalText}`;

  const sp = speed || '–';
  const et = eta || '–';
  if (meta) meta.textContent = `${pct}% • ${sp} • ${et}`;

  if (status && st) {
    st.dataset.statusKey = status;
    st.textContent = translateStatus(status);
  }
}

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function loadConfig() {
  const configPath = path.join(os.homedir(), '.config', 'server_uploader', 'config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

function getActiveProfile() {
  const name = activeProfileName || profileSelect.value;
  const profile = activeProfile || (configCache?.profiles ? configCache.profiles[name] : null);
  if (!name || !profile) throw new Error(`Profile not found: ${name || '(none)'}`);
  return { name, profile };
}

function initProfiles(cfg) {
  profileSelect.innerHTML = '';

  Object.keys(cfg.profiles).forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    profileSelect.appendChild(opt);
  });

  const defaultName = cfg.defaultProfile;
  profileSelect.value = defaultName;

  activeProfileName = defaultName;
  activeProfile = cfg.profiles[defaultName];
  activeProfileLabel.textContent = t('profile.using', { name: defaultName });

  remoteDirInput.readOnly = false;

  const profileDefault = (cfg.profiles[defaultName] && cfg.profiles[defaultName].remoteDirDefault) || '';
  const globalDefault = cfg.remoteDirDefault || '';

  // Default shown in UI: per-profile default, falling back to global default.
  const resolvedDefault = profileDefault || globalDefault || t('remote.notSet');
  remoteDirDefaultLabel.textContent = resolvedDefault;
  if (remoteDirBaseDefaultLabel) {
    remoteDirBaseDefaultLabel.textContent = resolvedDefault;
  }

  // Current value: in-memory override for this profile, otherwise the defaults.
  remoteDirByProfile[defaultName] = remoteDirByProfile[defaultName] || profileDefault || globalDefault || '';
  remoteDirInput.value = remoteDirByProfile[defaultName];

  // Remote roots per profile (if defined)
  const roots = getEffectiveRootsForProfile(defaultName);
  remoteRootsByProfile[defaultName] = roots;
  syncRemoteRootsSelect(roots);
}

function testSSH(profile) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);

    const args = [
      '-i', key,
      '-p', port,
      `${user}@${host}`,
      'echo CONNECT_OK && whoami && hostname'
    ];

    const proc = spawn('ssh', args);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));

    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`ssh exit ${code}\n${stderr.trim()}`));
    });
  });
}

// Ensure remoteDir exists and is a directory, or create it. If not a dir, reject.
function ensureRemoteDir(profile, remoteDir) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);

    // Resolve symlinks (important: rsync can fail if the dest path is a symlink).
    // Return the resolved path so callers can use it.
    const cmd = `REAL=\"${remoteDir}\"; `
      + `R2=$(readlink -f \"${remoteDir}\" 2>/dev/null); `
      + `if [ -n \"$R2\" ]; then REAL=\"$R2\"; fi; `
      + `if [ -d \"$REAL\" ]; then echo \"$REAL\"; exit 0; fi; `
      + `if [ -e \"$REAL\" ]; then echo \"NOT_A_DIR:$REAL\"; exit 2; fi; `
      + `mkdir -p \"$REAL\" && echo \"$REAL\"`;

    const args = ['-i', key, '-p', port, `${user}@${host}`, cmd];
    const proc = spawn('ssh', args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      const out = stdout.trim();
      if (code === 0) return resolve(out || remoteDir);
      if (code === 2 || out.startsWith('NOT_A_DIR:')) {
        const p = out.replace(/^NOT_A_DIR:/, '') || remoteDir;
        return reject(new Error(`Remote path exists but is not a directory: ${p}`));
      }
      return reject(new Error(`ssh ensureRemoteDir exit ${code}\n${stderr.trim()}`));
    });
  });
}

function uploadFile(profile, localFile, remoteDir, uploadId, onProgress) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);

    const args = [
      '-a',
      '--human-readable',
      '--info=progress2',
      '--exclude=.DS_Store',
      '--exclude=._*',
      '-e',
      `ssh -i ${key} -p ${port}`,
      localFile,
      `${user}@${host}:${remoteDir}/`
    ];

    const proc = spawn('rsync', args);
    const remoteTarget = `${remoteDir.replace(/\/+$/, '')}/${path.basename(localFile)}`;
    activeUploads.set(uploadId, { proc, remoteTarget, profile });

    let stdoutBuf = '';
    let stderr = '';

    proc.stdout.on('data', (d) => {
      // rsync updates progress on the same line using carriage returns (\r).
      // Normalize \r to \n so we can parse progress incrementally.
      stdoutBuf += d.toString().replace(/\r/g, '\n');
      const lines = stdoutBuf.split(/\n/);
      stdoutBuf = lines.pop() || '';

      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        // Parse rsync progress lines and update UI live WITHOUT spamming the log.
        const pm = line.match(/^([\d.,]+[KMGTP]?B?)\s+(\d+)%\s+(\S+\/s)\s+(\d+:\d+(?::\d+)?)/);
        if (pm && typeof onProgress === 'function') {
          const transferredToken = pm[1];
          const percent = Number(pm[2]);
          const speed = pm[3];
          const eta = pm[4];

          const transferredBytes = humanToBytes(transferredToken);
          onProgress({ transferredBytes, percent, speed, eta });
          continue; // don't append progress lines to the log
        }

        // Keep only non-progress lines (rare) for context/debug
        log(line);
      }
    });

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      activeUploads.delete(uploadId);
      if (code === 0) {
        resolve('UPLOAD_OK');
      } else {
        reject(new Error(`rsync exit ${code}\n${stderr.trim()}`));
      }
    });
  });
}
function uploadFolder(profile, localDir, remoteDir, uploadId, onProgress) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);

    // Always create a subfolder on the server named after the selected folder:
    // remoteDir/<folderName>/...
    const folderName = path.basename(localDir);
    const remoteTarget = `${remoteDir.replace(/\/+$/, '')}/${folderName}`;

    // Ensure the target folder exists on the server
    const mkdirArgs = [
      '-i', key,
      '-p', port,
      `${user}@${host}`,
      `mkdir -p "${remoteTarget}"`
    ];
    const mkdirProc = spawn('ssh', mkdirArgs);

    let mkdirStderr = '';
    mkdirProc.stderr.on('data', (d) => (mkdirStderr += d.toString()));

    mkdirProc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ssh mkdir exit ${code}\n${mkdirStderr.trim()}`));
        return;
      }

      // Copy the CONTENTS of the folder into remoteTarget/ (note the trailing slash on localDir)
      const args = [
        '-a',
        '--human-readable',
        '--info=progress2',
        '--exclude=.DS_Store',
        '--exclude=._*',
        '-e',
        `ssh -i ${key} -p ${port}`,
        `${localDir.replace(/\/+$/, '')}/`,
        `${user}@${host}:${remoteTarget}/`
      ];

      const proc = spawn('rsync', args);
      activeUploads.set(uploadId, { proc, remoteTarget, profile });

      let stdoutBuf = '';
      let stderr = '';

      proc.stdout.on('data', (d) => {
        stdoutBuf += d.toString().replace(/\r/g, '\n');
        const lines = stdoutBuf.split(/\n/);
        stdoutBuf = lines.pop() || '';

        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;

          const pm = line.match(/^([\d.,]+[KMGTP]?B?)\s+(\d+)%\s+(\S+\/s)\s+(\d+:\d+(?::\d+)?)/);
          if (pm && typeof onProgress === 'function') {
            const transferredToken = pm[1];
            const percent = Number(pm[2]);
            const speed = pm[3];
            const eta = pm[4];

            const transferredBytes = humanToBytes(transferredToken);
            onProgress({ transferredBytes, percent, speed, eta });
            continue; // don't append progress lines to the log
          }

          // Folder sync can print tons of filenames; keep the log clean.
          // If you want verbose filenames later, we can add a "Verbose log" toggle.
          // For now: ignore non-progress stdout lines.
        }
      });

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', (code2) => {
        activeUploads.delete(uploadId);
        if (code2 === 0) resolve('UPLOAD_OK');
        else reject(new Error(`rsync exit ${code2}\n${stderr.trim()}`));
      });
    });
  });
}

function listRemoteDirs(profile, rootPath) {
  return new Promise((resolve, reject) => {
    const profileName = activeProfileName || profileSelect.value;
    const allowed = remoteRootsByProfile[profileName] || getEffectiveRootsForProfile(profileName);
    if (!allowed.includes(rootPath) || isCriticalRemotePath(rootPath)) {
      reject(new Error('Root path not permès'));
      return;
    }
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);
    const findCmd = `if [ ! -d "${rootPath}" ]; then echo "__ROOT_MISSING__"; exit 0; fi; find "${rootPath}" -maxdepth 2 -type d -not -path '*/.*' -print`;
    const args = ['-i', key, '-p', port, `${user}@${host}`, findCmd];
    const proc = spawn('ssh', args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) {
        const lines = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
        if (lines.includes('__ROOT_MISSING__')) {
          resolve({ dirs: [], missing: true });
          return;
        }
        resolve({ dirs: lines, missing: false });
      } else {
        reject(new Error(`ssh find exit ${code}\n${stderr.trim()}`));
      }
    });
  });
}

function deleteRemotePath(profile, remotePath) {
  return new Promise((resolve, reject) => {
    const host = profile.host;
    const port = String(profile.port ?? 22);
    const user = profile.user;
    const key = expandHome(profile.identityFile);
    const cmd = `rm -rf -- \"${remotePath}\"`;
    const args = ['-i', key, '-p', port, `${user}@${host}`, cmd];
    const proc = spawn('ssh', args);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve('DELETE_OK');
      else reject(new Error(`ssh rm exit ${code}\n${stderr.trim()}`));
    });
  });
}

btn.addEventListener('click', async () => {
  if (activityOut) activityOut.textContent = '';
  try {
    log(t('status.configLoading'));
    const cfg = loadConfig();

    const { name, profile } = getActiveProfile();
    log(t('status.activeProfile', { name }));
    log(t('status.host', { host: `${profile.user}@${profile.host}:${profile.port ?? 22}` }));
    log(t('status.sshRunning'));

    const res = await testSSH(profile);
    log(t('status.result'));
    log(res);
  } catch (err) {
    log(t('status.errorHeader'));
    log(formatAppError(err));
  }
});
const btnUpload = document.getElementById('btnUpload');
const btnUploadFolder = document.getElementById('btnUploadFolder');

btnUpload.addEventListener('click', async () => {
  if (activityOut) activityOut.textContent = '';
  if (uploadsList) uploadsList.innerHTML = '';
  startLogSession('upload_files');
  try {
    const { profile } = getActiveProfile();

    // Selecció de fitxer(s)
    const res = await ipcRenderer.invoke('pick-file');

    if (res.canceled || !res.filePaths?.length) {
      log(t('status.uploadCancelled'));
      return;
    }

    const files = res.filePaths.filter((p) => {
      const base = path.basename(p);
      if (base === '.DS_Store') return false;
      if (base.startsWith('._')) return false;
      return true;
    });

    if (!files.length) {
      log(t('status.noValidFiles'));
      return;
    }

    const remoteDir = remoteDirInput.value.trim();
    if (!remoteDir) {
      throw new Error(t('status.remoteDirMissing'));
    }

    // Remember per-profile override (in-memory)
    remoteDirByProfile[activeProfileName || profileSelect.value] = remoteDir;

    log(t('status.ensuringRemoteDir'));
    const remoteDirResolved = await ensureRemoteDir(profile, remoteDir);

    log(t('status.remoteDir', { path: remoteDirResolved }));
    log(t('status.filesSelected', { count: files.length }));

    // Upload in parallel with a small concurrency limit (robust + fast)
    const MAX_PARALLEL = 3;

    async function runPool(items, limit, worker) {
      const executing = new Set();
      const results = [];

      for (const item of items) {
        const p = Promise.resolve().then(() => worker(item));
        results.push(p);
        executing.add(p);

        const clean = () => executing.delete(p);
        p.then(clean).catch(clean);

        if (executing.size >= limit) {
          await Promise.race(executing);
        }
      }

      return Promise.allSettled(results);
    }

    const settled = await runPool(files.map((localFile, idx) => ({ localFile, idx })), MAX_PARALLEL, async ({ localFile, idx }) => {
      const filename = path.basename(localFile);
      const totalBytes = fs.statSync(localFile).size;
      const uploadId = makeUploadId('file');

      createUploadRow({
        uploadId,
        title: t('uploads.fileTitle', { index: idx + 1, total: files.length, name: filename }),
        totalBytes,
        remoteDir: remoteDirResolved,
      });

      updateUploadRow(uploadId, { status: 'uploading', transferredBytes: 0, totalBytes, percent: 0, speed: '–', eta: '–' });

      log('---');
      log(t('status.uploadingFile', { index: idx + 1, total: files.length, path: localFile }));

      try {
        const result = await uploadFile(profile, localFile, remoteDirResolved, uploadId, ({ transferredBytes, percent, speed, eta }) => {
          updateUploadRow(uploadId, { transferredBytes, totalBytes, percent, speed, eta, status: 'uploading' });
        });

        updateUploadRow(uploadId, { transferredBytes: totalBytes, totalBytes, percent: 100, speed: '-', eta: '0:00:00', status: 'done' });
        log(t('status.resultLine', { result }));
      } catch (err) {
        updateUploadRow(uploadId, { status: 'error', speed: '–', eta: '–' });
        log(`ERROR (${idx + 1}/${files.length}): ${String(err.message || err)}`);
        throw err;
      }
    });

    const failed = settled.filter((r) => r.status === 'rejected');
    if (failed.length) {
      log('---');
      log(t('status.finishedWithErrors', { failed: failed.length, total: files.length }));
      failed.forEach((r) => log(String(r.reason?.message || r.reason || r)));
    } else {
      log('---');
      log(t('status.allUploadsFinished'));
      if (currentLogFile) log(t('status.logSaved', { path: currentLogFile }));
    }
  } catch (err) {
    log(t('status.errorHeader'));
    log(formatAppError(err, { path: remoteDirInput.value.trim() }));
    if (currentLogFile) log(t('status.logSaved', { path: currentLogFile }));
  }
});

if (btnUploadFolder) {
  btnUploadFolder.addEventListener('click', async () => {
    if (activityOut) activityOut.textContent = '';
    if (uploadsList) uploadsList.innerHTML = '';
    startLogSession('upload_folder');
    try {
      const { profile } = getActiveProfile();

      const remoteDir = remoteDirInput.value.trim();
      if (!remoteDir) {
        throw new Error(t('status.remoteDirMissing'));
      }

      remoteDirByProfile[activeProfileName || profileSelect.value] = remoteDir;

      log(t('status.ensuringRemoteDir'));
      const remoteDirResolved = await ensureRemoteDir(profile, remoteDir);

      // Select a local folder
      const res = await ipcRenderer.invoke('pick-folder');
      if (res.canceled || !res.filePaths?.length) {
        log(t('status.uploadFolderCancelled'));
        return;
      }

      const localDir = res.filePaths[0];
      const folderName = path.basename(localDir);

      // Unknown total without scanning; show percent + transferred.
      const uploadId = makeUploadId('folder');
      createUploadRow({ uploadId, title: t('uploads.folderTitle', { name: folderName }), totalBytes: 0, remoteDir: remoteDirResolved });
      updateUploadRow(uploadId, { status: 'uploading', transferredBytes: 0, totalBytes: 0, percent: 0, speed: '–', eta: '–' });

      log(t('status.remoteDir', { path: remoteDirResolved }));
      log(t('status.uploadingFolder', { path: localDir }));
      log(t('status.uploadingFolderRsync'));

      try {
        const result = await uploadFolder(profile, localDir, remoteDirResolved, uploadId, ({ transferredBytes, percent, speed, eta }) => {
          updateUploadRow(uploadId, { transferredBytes, totalBytes: 0, percent, speed, eta, status: 'uploading' });
        });

        log(t('status.resultLine', { result }));
        updateUploadRow(uploadId, { transferredBytes: 0, totalBytes: 0, percent: 100, speed: '-', eta: '0:00:00', status: 'done' });
        log('---');
        log(t('status.folderUploadFinished'));
        if (currentLogFile) log(t('status.logSaved', { path: currentLogFile }));
      } catch (err) {
        updateUploadRow(uploadId, { status: 'error', speed: '–', eta: '–' });
        log(`ERROR folder: ${String(err.message || err)}`);
        throw err;
      }
    } catch (err) {
      log(t('status.errorHeader'));
      log(formatAppError(err, { path: remoteDirInput.value.trim() }));
      if (currentLogFile) log(t('status.logSaved', { path: currentLogFile }));
    }
  });
}

profileSelect.addEventListener('change', () => {
  const name = profileSelect.value;
  activeProfileName = name;
  activeProfile = configCache.profiles[name];
  activeProfileLabel.textContent = t('profile.using', { name });
  log(t('status.profileChanged', { name }));

  const profileDefault = (configCache.profiles[name] && configCache.profiles[name].remoteDirDefault) || '';
  const globalDefault = configCache.remoteDirDefault || '';

  const resolvedDefault = profileDefault || globalDefault || t('remote.notSet');
  remoteDirDefaultLabel.textContent = resolvedDefault;
  if (remoteDirBaseDefaultLabel) {
    remoteDirBaseDefaultLabel.textContent = resolvedDefault;
  }

  remoteDirByProfile[name] = remoteDirByProfile[name] || profileDefault || globalDefault || '';
  remoteDirInput.value = remoteDirByProfile[name];

  const roots = getEffectiveRootsForProfile(name);
  remoteRootsByProfile[name] = roots;
  syncRemoteRootsSelect(roots);
});

function syncRemoteRootsSelect(roots) {
  if (remoteRootSelect) {
    const previousValue = remoteRootSelect.value;
    remoteRootSelect.innerHTML = '';
    if (!roots.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = t('roots.noneSaved');
      remoteRootSelect.appendChild(opt);
    } else {
      roots.forEach((r) => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        remoteRootSelect.appendChild(opt);
      });
      remoteRootSelect.value = roots.includes(previousValue) ? previousValue : roots[0];
    }
  }

}

if (btnFetchRemoteDirs && remoteDirList) {
  btnFetchRemoteDirs.addEventListener('click', async () => {
    try {
      const root = remoteRootSelect.value;
      const { profile } = getActiveProfile();
      remoteDirList.innerHTML = `<option value="">${escapeHtml(t('assistant.loading'))}</option>`;
      const { dirs, missing } = await listRemoteDirs(profile, root);
      remoteDirList.innerHTML = '';
      dirs.forEach((p) => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        remoteDirList.appendChild(opt);
      });
      if (!dirs.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = t('assistant.empty');
        remoteDirList.appendChild(opt);
      }
      remoteDirHint.textContent = missing
        ? t('assistant.baseMissing', { root })
        : t('assistant.listedCount', { count: dirs.length, root });
    } catch (err) {
      remoteDirHint.textContent = `ERROR: ${String(err.message || err)}`;
    }
  });
}

if (btnUseRemoteDir && remoteDirList) {
  btnUseRemoteDir.addEventListener('click', () => {
    const val = remoteDirList.value;
    if (val) {
      remoteDirInput.value = val;
      log(t('status.remoteSelected', { path: val }));
    }
  });
}

if (btnUseRemoteRoot && remoteRootSelect) {
  btnUseRemoteRoot.addEventListener('click', () => {
    const val = remoteRootSelect.value;
    if (val) {
      remoteDirInput.value = val;
      log(t('status.remoteSet', { path: val }));
    }
  });
}

function joinRemotePath(base, sub) {
  const cleanBase = (base || '').replace(/\/+$/, '');
  const cleanSub = (sub || '').replace(/^\/+/, '');
  return cleanSub ? `${cleanBase}/${cleanSub}` : cleanBase;
}

if (btnComposeRemote && newSubfolderInput) {
  btnComposeRemote.addEventListener('click', () => {
    const baseFromList = remoteDirList.value || remoteRootSelect?.value || '';
    const sub = newSubfolderInput.value.trim();
    if (!baseFromList) {
      remoteDirHint.textContent = t('assistant.selectBaseFirst');
      return;
    }
    const composed = joinRemotePath(baseFromList, sub);
    remoteDirInput.value = composed;
    log(t('status.remoteSet', { path: composed }));
  });
}

if (btnAddRemoteRoot && remoteRootInput) {
  btnAddRemoteRoot.addEventListener('click', () => {
    const profileName = activeProfileName || profileSelect.value;
    const normalized = normalizeRemotePath(remoteRootInput.value);

    if (!remoteRootInput.value.trim()) {
      remoteRootsHint.textContent = t('roots.emptyInput');
      return;
    }

    if (!normalized) {
      remoteRootsHint.textContent = t('roots.invalid');
      return;
    }

    if (isCriticalRemotePath(normalized)) {
      remoteRootsHint.textContent = t('roots.blocked');
      return;
    }

    const currentRoots = getEffectiveRootsForProfile(profileName);
    if (currentRoots.includes(normalized)) {
      remoteRootsHint.textContent = t('roots.duplicate');
      return;
    }

    const nextRoots = [...currentRoots, normalized].sort((a, b) => a.localeCompare(b));
    persistRootsForProfile(profileName, nextRoots);
    remoteRootsByProfile[profileName] = nextRoots;
    syncRemoteRootsSelect(nextRoots);
    remoteRootInput.value = '';
    remoteRootsHint.textContent = t('roots.added', { path: normalized });
  });
}

if (btnRemoveRemoteRoot && remoteRootSelect) {
  btnRemoveRemoteRoot.addEventListener('click', () => {
    const selected = remoteRootSelect.value;
    if (!selected) return;

    const profileName = activeProfileName || profileSelect.value;
    const currentRoots = getEffectiveRootsForProfile(profileName);
    const nextRoots = currentRoots.filter((root) => root !== selected);
    persistRootsForProfile(profileName, nextRoots);
    remoteRootsByProfile[profileName] = nextRoots;
    syncRemoteRootsSelect(nextRoots);
    remoteRootsHint.textContent = t('roots.removed', { path: selected });
  });
}

if (btnResetRemoteRoots) {
  btnResetRemoteRoots.addEventListener('click', () => {
    const profileName = activeProfileName || profileSelect.value;
    resetPersistedRootsForProfile(profileName);
    const nextRoots = getConfigRootsForProfile(profileName);
    remoteRootsByProfile[profileName] = nextRoots;
    syncRemoteRootsSelect(nextRoots);
    remoteRootsHint.textContent = t('roots.resetDone');
  });
}

if (btnCancelUpload) {
  btnCancelUpload.addEventListener('click', async () => {
    if (activeUploads.size === 0) {
      log(t('status.noUploadsRunning'));
      return;
    }

    log(t('status.cancellingUploads', { count: activeUploads.size }));

    const entries = Array.from(activeUploads.entries());

    // First, signal all rsync processes
    for (const [uploadId, info] of entries) {
      try {
        info.proc.kill('SIGINT');
        updateUploadRow(uploadId, { status: 'cancelling' });
      } catch (_) {
        // ignore
      }
    }

    // Optionally delete remote targets
    if (chkDeleteOnCancel?.checked) {
      for (const [uploadId, info] of entries) {
        if (!info.remoteTarget || !info.profile) continue;
        try {
          const res = await deleteRemotePath(info.profile, info.remoteTarget);
          log(t('status.remoteDeleted', { id: uploadId, result: res }));
        } catch (err) {
          log(t('status.remoteDeleteError', { id: uploadId, error: String(err.message || err) }));
        }
      }
    }
  });
}

function bootstrap() {
  try {
    currentLanguage = getStoredLanguage();
    configCache = loadConfig();
    initProfiles(configCache);
    applyTranslations();
    log(t('status.configLoaded'));
    refreshLogsSelect();
  } catch (err) {
    log(t('status.configLoadError'));
    log(formatAppError(err));
  }
}

// --- Log UI (raw viewer) ---
if (btnRefreshLogs) {
  btnRefreshLogs.addEventListener('click', () => {
    try {
      refreshLogsSelect();
      log(t('status.logsRefreshed'));
    } catch (err) {
      log(t('status.logsRefreshError', { error: String(err.message || err) }));
    }
  });
}

if (btnViewLogRaw) {
  btnViewLogRaw.addEventListener('click', () => {
    viewSelectedLogRaw();
  });
}

if (selLogs) {
  selLogs.addEventListener('change', () => {
    // lightweight: don't auto-load on change; keep it manual unless you prefer auto.
    // If you want auto-load, uncomment next line:
    // viewSelectedLogRaw();
  });
}

if (btnOpenLogsFolder) {
  btnOpenLogsFolder.addEventListener('click', async () => {
    try {
      const dir = await ipcRenderer.invoke('open-logs-folder');
      log(t('status.logsOpened', { path: dir }));
    } catch (err) {
      log(t('status.logsOpenError', { error: String(err.message || err) }));
    }
  });
}

langButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setLanguage(button.dataset.lang);
  });
});

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
