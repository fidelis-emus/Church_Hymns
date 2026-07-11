<?php
/**
 * Worship Portal & Hymnal Display REST API
 * Single-file PHP REST API using SQLite and plain PHP 8+.
 * 
 * Main features:
 * - SQLite auto-initialization and seeding
 * - Structured PDO database connection layer
 * - Advanced routing for all resources
 * - HMAC-SHA256 based JWT-like stateless authentication middleware
 * - Robust input validation layer
 * - Integrated request logging & activity tracking
 * - Pagination, filtering, and sorting for list endpoints
 * - Standardized JSON response utilities and CORS support
 */

// ==========================================
// 1. ENVIRONMENT CONFIGURATION & CORS
// ==========================================

// Prevent displaying raw errors to clients in production, but enable logging
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Define storage paths and configuration
define('DB_DIR', __DIR__ . '/storage');
define('DB_FILE', DB_DIR . '/database.sqlite');
define('LOG_FILE', DB_DIR . '/api_requests.log');
define('JWT_SECRET', 'grace_community_church_secure_key_2026'); // Replace with environmental secret if available

// Ensure database storage directory exists
if (!file_exists(DB_DIR)) {
    mkdir(DB_DIR, 0777, true);
}

// ==========================================
// 2. LOGGING HELPER
// ==========================================
function logApiRequest($method, $uri, $statusCode, $username = 'anonymous') {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] IP: $ip | User: $username | $method $uri | Status: $statusCode\n";
    file_put_contents(LOG_FILE, $logEntry, FILE_APPEND);
}

// ==========================================
// 3. DATABASE CONNECTION & SCHEMA MIGRATIONS
// ==========================================
function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    try {
        $pdo = new PDO("sqlite:" . DB_FILE);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        
        // Enable WAL mode for performance on concurrent environments
        $pdo->exec("PRAGMA journal_mode=WAL;");
        $pdo->exec("PRAGMA foreign_keys=ON;");
        
        // Initialize schema tables if they do not exist
        initializeSchema($pdo);
        
    } catch (PDOException $e) {
        errorResponse("Database Connection Failure: " . $e->getMessage(), 500);
    }
    
    return $pdo;
}

function initializeSchema(PDO $db) {
    // Create users table
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'ADMIN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );");

    // Create hymns table
    $db->exec("CREATE TABLE IF NOT EXISTS hymns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hymn_number INTEGER UNIQUE NOT NULL,
        title TEXT NOT NULL,
        lyrics TEXT NOT NULL,
        chorus TEXT,
        category TEXT NOT NULL,
        language TEXT DEFAULT 'English',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );");

    // Create announcements table
    $db->exec("CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        date TEXT,
        priority TEXT DEFAULT 'MEDIUM',
        expiry_date TEXT,
        status TEXT DEFAULT 'PUBLISHED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );");

    // Create citations table
    $db->exec("CREATE TABLE IF NOT EXISTS citations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        verse TEXT NOT NULL,
        display_text TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );");

    // Create custom_messages table
    $db->exec("CREATE TABLE IF NOT EXISTS custom_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );");

    // Create current_displays table (ensure unique display record)
    $db->exec("CREATE TABLE IF NOT EXISTS current_displays (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        display_type TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'PUBLISHED'
    );");

    // Create activity_logs table
    $db->exec("CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        username TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );");

    // Create settings table
    $db->exec("CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );");

    // Create display_histories table
    $db->exec("CREATE TABLE IF NOT EXISTS display_histories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        display_type TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        displayed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );");

    // Seed default administrator if empty
    $stmt = $db->query("SELECT COUNT(*) as count FROM users");
    $userCount = $stmt->fetch()['count'];
    if ($userCount == 0) {
        $adminPassHash = password_hash('admin123', PASSWORD_BCRYPT);
        $insertAdmin = $db->prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)");
        $insertAdmin->execute(['admin', 'admin@church.org', $adminPassHash, 'SUPER_ADMIN']);
    }

    // Seed default settings if empty
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM settings WHERE key = ?");
    $stmt->execute(['branding_settings']);
    $settingsCount = $stmt->fetch()['count'];
    if ($settingsCount == 0) {
        $defaultSettings = [
            'churchName' => 'Grace Community Church',
            'headerText' => 'Welcome to worship service!',
            'footerText' => 'Join us for refreshments after service!',
            'footerBibleVerse' => 'The Lord bless you and keep you. - Numbers 6:24',
            'footerContact' => 'info@gracechurch.org',
            'footerAddress' => '123 Grace Way, Faith City',
            'footerPhone' => '+1 (555) 123-4567',
            'footerEmail' => 'contact@gracechurch.org',
            'footerCopyright' => '© 2026 Grace Community Church. All rights reserved.',
            'primaryColor' => '#5A5A40',
            'secondaryColor' => '#2D3A3A',
            'backgroundColor' => '#F5F5F0',
            'textColor' => '#2D3A3A',
            'fontSize' => 'medium',
            'fontFamily' => 'serif'
        ];
        $insertSettings = $db->prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
        $insertSettings->execute(['branding_settings', json_encode($defaultSettings)]);
    }

    // Seed welcome slide if empty
    $stmt = $db->query("SELECT COUNT(*) as count FROM current_displays");
    $displayCount = $stmt->fetch()['count'];
    if ($displayCount == 0) {
        $db->exec("INSERT INTO current_displays (id, display_type, record_id, status) VALUES (1, 'WELCOME_SLIDE', 0, 'PUBLISHED')");
    }
}

// ==========================================
// 4. RESPONSE & VALIDATION HELPERS
// ==========================================
function successResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    logApiRequest($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'], $statusCode, $GLOBALS['authenticatedUser']['username'] ?? 'anonymous');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit();
}

function errorResponse($message, $statusCode = 500) {
    http_response_code($statusCode);
    logApiRequest($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'], $statusCode, $GLOBALS['authenticatedUser']['username'] ?? 'anonymous');
    echo json_encode(["error" => $message], JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit();
}

function validateRequest($data, $rules) {
    $errors = [];
    foreach ($rules as $field => $requirement) {
        if ($requirement === 'required' && (!isset($data[$field]) || $data[$field] === '')) {
            $errors[] = "Field '$field' is required.";
        }
    }
    if (!empty($errors)) {
        errorResponse(implode(' ', $errors), 400);
    }
}

function logActivity(PDO $db, $username, $action, $details) {
    try {
        $stmt = $db->prepare("INSERT INTO activity_logs (username, action, details) VALUES (?, ?, ?)");
        $stmt->execute([$username, $action, $details]);
    } catch (Exception $e) {
        // Suppress failure inside log logging to prevent loop, but log in standard php log
        error_log("Failed to log activity: " . $e->getMessage());
    }
}

// ==========================================
// 5. SECURITY & STATELINK TOKEN ENGINES
// ==========================================
function generateToken($payload) {
    $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $payload['exp'] = time() + (8 * 3600); // 8 Hours Expiration
    
    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode(json_encode($payload)));
    
    $signature = hash_hmac('sha256', "$base64UrlHeader.$base64UrlPayload", JWT_SECRET, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    return "$base64UrlHeader.$base64UrlPayload.$base64UrlSignature";
}

function verifyToken($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }
    
    list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $parts;
    
    $signature = hash_hmac('sha256', "$base64UrlHeader.$base64UrlPayload", JWT_SECRET, true);
    $expectedSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    if (!hash_equals($expectedSignature, $base64UrlSignature)) {
        return false;
    }
    
    $payload = json_decode(base64_decode(str_replace(['-','_'], ['+','/'], $base64UrlPayload)), true);
    if (isset($payload['exp']) && $payload['exp'] < time()) {
        return false; // Token expired
    }
    
    return $payload;
}

function authenticateToken(): array {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    
    if (str_starts_with($authHeader, 'Bearer ')) {
        $token = substr($authHeader, 7);
        $payload = verifyToken($token);
        if ($payload) {
            $GLOBALS['authenticatedUser'] = $payload;
            return $payload;
        }
    }
    
    errorResponse("Unauthorized: Missing or invalid authentication token", 401);
    return [];
}

function requireRole($allowedRoles, $user) {
    $roles = is_array($allowedRoles) ? $allowedRoles : [$allowedRoles];
    if (!isset($user['role']) || !in_array($user['role'], $roles)) {
        errorResponse("Forbidden: You do not have permission to execute this operation", 403);
    }
}

// Helper to hydrate current displays
function getHydratedDisplayData(PDO $db, $type, $rId) {
    if ($type === 'HYMN') {
        $stmt = $db->prepare("SELECT * FROM hymns WHERE id = ?");
        $stmt->execute([$rId]);
        $row = $stmt->fetch();
        if ($row) {
            $row['hymnNumber'] = (int)$row['hymn_number'];
            unset($row['hymn_number']);
            return $row;
        }
    } elseif ($type === 'ANNOUNCEMENT') {
        $stmt = $db->prepare("SELECT * FROM announcements WHERE id = ?");
        $stmt->execute([$rId]);
        $row = $stmt->fetch();
        if ($row) {
            $row['expiryDate'] = $row['expiry_date'];
            unset($row['expiry_date']);
            return $row;
        }
    } elseif ($type === 'CITATION') {
        $stmt = $db->prepare("SELECT * FROM citations WHERE id = ?");
        $stmt->execute([$rId]);
        $row = $stmt->fetch();
        if ($row) {
            $row['displayText'] = $row['display_text'];
            unset($row['display_text']);
            return $row;
        }
    } elseif ($type === 'MESSAGE') {
        $stmt = $db->prepare("SELECT * FROM custom_messages WHERE id = ?");
        $stmt->execute([$rId]);
        return $stmt->fetch() ?: null;
    }
    
    return [
        'title' => 'Welcome to Our Sanctuary',
        'body' => 'Glad you joined us today. Prepare your hearts for worship.'
    ];
}

// ==========================================
// 6. ROUTER ENTRY POINT & DISPATCHER
// ==========================================

$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$requestUri = $_SERVER['REQUEST_URI'] ?? '';

// Support query param 'route' fallback for clean URLs on simple servers
$path = parse_url($requestUri, PHP_URL_PATH);
$scriptName = $_SERVER['SCRIPT_NAME'];
$basePath = dirname($scriptName);

if (str_starts_with($path, $scriptName)) {
    $subPath = substr($path, strlen($scriptName));
} elseif ($basePath !== '/' && str_starts_with($path, $basePath)) {
    $subPath = substr($path, strlen($basePath));
} else {
    $subPath = $path;
}

// Remove api prefix from URL if rewrite puts it there
$subPath = preg_replace('/^\/api/', '', $subPath);
$route = '/' . trim($subPath, '/');

// Decoded inputs
$input = json_decode(file_get_contents('php://input'), true) ?? [];

// Helper route registration matching list
$routes = [
    // AUTHENTICATION
    'POST' => [
        '/^auth\/login$/' => 'handleLogin',
        '/^auth\/users$/' => 'handleCreateUser',
        '/^hymns$/' => 'handleCreateHymn',
        '/^hymns\/(\d+)\/duplicate$/' => 'handleDuplicateHymn',
        '/^display\/hymn\/(\d+)$/' => 'handleDisplayHymn',
        '/^announcements$/' => 'handleCreateAnnouncement',
        '/^display\/announcement\/(\d+)$/' => 'handleDisplayAnnouncement',
        '/^citations$/' => 'handleCreateCitation',
        '/^display\/citation\/(\d+)$/' => 'handleDisplayCitation',
        '/^messages$/' => 'handleCreateMessage',
        '/^display\/message\/(\d+)$/' => 'handleDisplayMessage',
        '/^display\/welcome$/' => 'handleDisplayWelcome',
        '/^settings$/' => 'handleSaveSettings',
        '/^restore$/' => 'handleRestore',
    ],
    'GET' => [
        '/^auth\/me$/' => 'handleGetMe',
        '/^auth\/users$/' => 'handleGetUsers',
        '/^hymns$/' => 'handleGetHymns',
        '/^hymns\/(\d+)$/' => 'handleGetHymnById',
        '/^announcements$/' => 'handleGetAnnouncements',
        '/^citations$/' => 'handleGetCitations',
        '/^messages$/' => 'handleGetMessages',
        '/^settings$/' => 'handleGetSettings',
        '/^logs$/' => 'handleGetLogs',
        '/^display\/current$/' => 'handleGetCurrentDisplay',
        '/^display\/history$/' => 'handleGetDisplayHistory',
        '/^stats$/' => 'handleGetStats',
        '/^backup$/' => 'handleBackup',
        '/^health$/' => 'handleHealthCheck',
    ],
    'PUT' => [
        '/^auth\/users\/(\d+)$/' => 'handleUpdateUser',
        '/^hymns\/(\d+)$/' => 'handleUpdateHymn',
        '/^announcements\/(\d+)$/' => 'handleUpdateAnnouncement',
        '/^citations\/(\d+)$/' => 'handleUpdateCitation',
        '/^messages\/(\d+)$/' => 'handleUpdateMessage',
    ],
    'DELETE' => [
        '/^auth\/users\/(\d+)$/' => 'handleDeleteUser',
        '/^hymns\/(\d+)$/' => 'handleDeleteHymn',
        '/^announcements\/(\d+)$/' => 'handleDeleteAnnouncement',
        '/^citations\/(\d+)$/' => 'handleDeleteCitation',
        '/^messages\/(\d+)$/' => 'handleDeleteMessage',
    ]
];

// Clean path format for matching
$cleanRoute = trim($route, '/');

// Match routing table
$matched = false;
if (isset($routes[$method])) {
    foreach ($routes[$method] as $pattern => $handler) {
        if (preg_match($pattern, $cleanRoute, $matches)) {
            $matched = true;
            array_shift($matches); // Remove whole match
            call_user_func_array($handler, array_merge([$db, $input], $matches));
            break;
        }
    }
}

if (!$matched) {
    errorResponse("Route not found: $method $route", 404);
}

// ==========================================
// 7. ROUTE HANDLER IMPLEMENTATIONS
// ==========================================

// 7.1. AUTHENTICATION HANDLERS
function handleLogin($db, $input) {
    validateRequest($input, ['username' => 'required', 'password' => 'required']);
    $username = $input['username'];
    $password = $input['password'];
    
    $stmt = $db->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    
    if (!$user || !password_verify($password, $user['password_hash'])) {
        errorResponse("Invalid username or password", 401);
    }
    
    $token = generateToken([
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'role' => $user['role']
    ]);
    
    logActivity($db, $username, 'LOGIN', "Logged in successfully via REST API");
    
    successResponse([
        'token' => $token,
        'user' => [
            'id' => (int)$user['id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ]);
}

function handleGetMe($db, $input) {
    $currUser = authenticateToken();
    $stmt = $db->prepare("SELECT id, username, email, role FROM users WHERE username = ?");
    $stmt->execute([$currUser['username']]);
    $user = $stmt->fetch();
    
    if (!$user) {
        errorResponse("User not found", 404);
    }
    
    successResponse([
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'role' => $user['role']
    ]);
}

function handleGetUsers($db, $input) {
    $currUser = authenticateToken();
    requireRole('SUPER_ADMIN', $currUser);
    
    $stmt = $db->query("SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY username ASC");
    $users = $stmt->fetchAll();
    
    // Cast correct types
    foreach ($users as &$u) {
        $u['id'] = (int)$u['id'];
    }
    
    successResponse($users);
}

function handleCreateUser($db, $input) {
    $currUser = authenticateToken();
    requireRole('SUPER_ADMIN', $currUser);
    validateRequest($input, [
        'username' => 'required', 
        'email' => 'required', 
        'password' => 'required', 
        'role' => 'required'
    ]);
    
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM users WHERE username = ?");
    $stmt->execute([$input['username']]);
    if ($stmt->fetch()['count'] > 0) {
        errorResponse("Username already exists", 400);
    }
    
    $hash = password_hash($input['password'], PASSWORD_BCRYPT);
    $stmt = $db->prepare("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)");
    $stmt->execute([$input['username'], $input['email'], $hash, $input['role']]);
    $newId = $db->lastInsertId();
    
    logActivity($db, $currUser['username'], 'CREATE_USER', "Created user account: " . $input['username'] . " (" . $input['role'] . ")");
    
    successResponse([
        'id' => (int)$newId,
        'username' => $input['username'],
        'email' => $input['email'],
        'role' => $input['role']
    ], 201);
}

function handleUpdateUser($db, $input, $id) {
    $currUser = authenticateToken();
    requireRole('SUPER_ADMIN', $currUser);
    
    $stmt = $db->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch();
    if (!$user) {
        errorResponse("User not found", 404);
    }
    
    $username = $input['username'] ?? $user['username'];
    $email = $input['email'] ?? $user['email'];
    $role = $input['role'] ?? $user['role'];
    
    if (isset($input['password']) && $input['password'] !== '') {
        $hash = password_hash($input['password'], PASSWORD_BCRYPT);
        $stmt = $db->prepare("UPDATE users SET username = ?, email = ?, password_hash = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$username, $email, $hash, $role, $id]);
    } else {
        $stmt = $db->prepare("UPDATE users SET username = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        $stmt->execute([$username, $email, $role, $id]);
    }
    
    logActivity($db, $currUser['username'], 'UPDATE_USER', "Updated user account: $username");
    
    successResponse([
        'id' => (int)$id,
        'username' => $username,
        'email' => $email,
        'role' => $role
    ]);
}

function handleDeleteUser($db, $input, $id) {
    $currUser = authenticateToken();
    requireRole('SUPER_ADMIN', $currUser);
    
    if ((int)$currUser['id'] === (int)$id) {
        errorResponse("Self-deletion is forbidden", 400);
    }
    
    $stmt = $db->prepare("SELECT username FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $username = $stmt->fetchColumn();
    if (!$username) {
        errorResponse("User not found", 404);
    }
    
    $stmt = $db->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);
    
    logActivity($db, $currUser['username'], 'DELETE_USER', "Deleted user account: $username");
    successResponse(['success' => true]);
}

// 7.2. HYMN HANDLERS
function handleGetHymns($db, $input) {
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';
    $category = isset($_GET['category']) ? trim($_GET['category']) : '';
    $sortBy = isset($_GET['sortBy']) && in_array($_GET['sortBy'], ['hymn_number', 'title', 'category']) ? $_GET['sortBy'] : 'hymn_number';
    $sortOrder = isset($_GET['sortOrder']) && strtoupper($_GET['sortOrder']) === 'DESC' ? 'DESC' : 'ASC';
    
    $offset = ($page - 1) * $limit;
    
    // Build SQL query
    $query = "FROM hymns WHERE 1=1";
    $params = [];
    
    if ($search !== '') {
        $keywords = preg_split('/\s+/', $search);
        foreach ($keywords as $kw) {
            $params[] = "%$kw%";
            $pNum = count($params);
            $query .= " AND (CAST(hymn_number AS TEXT) LIKE ?$pNum OR title LIKE ?$pNum OR lyrics LIKE ?$pNum OR chorus LIKE ?$pNum)";
        }
    }
    
    if ($category !== '') {
        $params[] = $category;
        $pNum = count($params);
        $query .= " AND category = ?$pNum";
    }
    
    // Total count query
    $countStmt = $db->prepare("SELECT COUNT(*) as total " . $query);
    $countStmt->execute($params);
    $total = (int)$countStmt->fetch()['total'];
    
    // Select records query
    $selectStmt = $db->prepare("SELECT id, hymn_number, title, lyrics, chorus, category, language, created_at, updated_at " . $query . " ORDER BY $sortBy $sortOrder LIMIT $limit OFFSET $offset");
    $selectStmt->execute($params);
    $hymns = $selectStmt->fetchAll();
    
    foreach ($hymns as &$h) {
        $h['id'] = (int)$h['id'];
        $h['hymnNumber'] = (int)$h['hymn_number'];
        unset($h['hymn_number']);
    }
    
    $pages = ceil($total / $limit);
    
    successResponse([
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'pages' => $pages,
        'hymns' => $hymns
    ]);
}

function handleGetHymnById($db, $input, $id) {
    $stmt = $db->prepare("SELECT * FROM hymns WHERE id = ?");
    $stmt->execute([$id]);
    $h = $stmt->fetch();
    
    if (!$h) {
        errorResponse("Hymn not found", 404);
    }
    
    $h['id'] = (int)$h['id'];
    $h['hymnNumber'] = (int)$h['hymn_number'];
    unset($h['hymn_number']);
    
    successResponse($h);
}

function handleCreateHymn($db, $input) {
    $currUser = authenticateToken();
    validateRequest($input, [
        'hymnNumber' => 'required',
        'title' => 'required',
        'lyrics' => 'required',
        'category' => 'required'
    ]);
    
    // Check uniqueness of hymn number
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM hymns WHERE hymn_number = ?");
    $stmt->execute([$input['hymnNumber']]);
    if ($stmt->fetch()['count'] > 0) {
        errorResponse("Hymn number already exists", 400);
    }
    
    $stmt = $db->prepare("INSERT INTO hymns (hymn_number, title, lyrics, chorus, category, language) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $input['hymnNumber'],
        $input['title'],
        $input['lyrics'],
        $input['chorus'] ?? null,
        $input['category'],
        $input['language'] ?? 'English'
    ]);
    $newId = $db->lastInsertId();
    
    logActivity($db, $currUser['username'], 'CREATE_HYMN', "Created Hymn #" . $input['hymnNumber'] . ": " . $input['title']);
    
    successResponse([
        'id' => (int)$newId,
        'hymnNumber' => (int)$input['hymnNumber'],
        'title' => $input['title'],
        'category' => $input['category']
    ], 201);
}

function handleUpdateHymn($db, $input, $id) {
    $currUser = authenticateToken();
    validateRequest($input, [
        'hymnNumber' => 'required',
        'title' => 'required',
        'lyrics' => 'required',
        'category' => 'required'
    ]);
    
    $stmt = $db->prepare("SELECT * FROM hymns WHERE id = ?");
    $stmt->execute([$id]);
    $hymn = $stmt->fetch();
    if (!$hymn) {
        errorResponse("Hymn not found", 404);
    }
    
    // Check uniqueness of hymn number
    $stmt = $db->prepare("SELECT COUNT(*) as count FROM hymns WHERE hymn_number = ? AND id != ?");
    $stmt->execute([$input['hymnNumber'], $id]);
    if ($stmt->fetch()['count'] > 0) {
        errorResponse("Hymn number already exists", 400);
    }
    
    $stmt = $db->prepare("UPDATE hymns SET hymn_number = ?, title = ?, lyrics = ?, chorus = ?, category = ?, language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([
        $input['hymnNumber'],
        $input['title'],
        $input['lyrics'],
        $input['chorus'] ?? null,
        $input['category'],
        $input['language'] ?? 'English',
        $id
    ]);
    
    logActivity($db, $currUser['username'], 'EDIT_HYMN', "Edited Hymn #" . $input['hymnNumber'] . ": " . $input['title']);
    
    successResponse([
        'id' => (int)$id,
        'hymnNumber' => (int)$input['hymnNumber'],
        'title' => $input['title']
    ]);
}

function handleDeleteHymn($db, $input, $id) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("SELECT hymn_number, title FROM hymns WHERE id = ?");
    $stmt->execute([$id]);
    $h = $stmt->fetch();
    if (!$h) {
        errorResponse("Hymn not found", 404);
    }
    
    $stmt = $db->prepare("DELETE FROM hymns WHERE id = ?");
    $stmt->execute([$id]);
    
    logActivity($db, $currUser['username'], 'DELETE_HYMN', "Deleted Hymn #" . $h['hymn_number'] . " " . $h['title']);
    successResponse(['success' => true]);
}

function handleDuplicateHymn($db, $input, $id) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("SELECT * FROM hymns WHERE id = ?");
    $stmt->execute([$id]);
    $h = $stmt->fetch();
    if (!$h) {
        errorResponse("Hymn to duplicate not found", 404);
    }
    
    // Find next available hymn number
    $stmt = $db->query("SELECT MAX(hymn_number) as max_num FROM hymns");
    $maxNum = (int)$stmt->fetch()['max_num'];
    $nextNum = $maxNum + 1;
    
    $dupTitle = $h['title'] . " (Copy)";
    
    $stmt = $db->prepare("INSERT INTO hymns (hymn_number, title, lyrics, chorus, category, language) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $nextNum,
        $dupTitle,
        $h['lyrics'],
        $h['chorus'],
        $h['category'],
        $h['language']
    ]);
    $newId = $db->lastInsertId();
    
    logActivity($db, $currUser['username'], 'DUPLICATE_HYMN', "Duplicated Hymn ID: $id to #$nextNum");
    
    successResponse([
        'id' => (int)$newId,
        'hymnNumber' => $nextNum,
        'title' => $dupTitle
    ], 201);
}

function handleDisplayHymn($db, $input, $id) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("SELECT * FROM hymns WHERE id = ?");
    $stmt->execute([$id]);
    $h = $stmt->fetch();
    if (!$h) {
        errorResponse("Hymn not found", 404);
    }
    
    // Set Current Display
    $stmt = $db->prepare("UPDATE current_displays SET display_type = 'HYMN', record_id = ?, last_updated = CURRENT_TIMESTAMP, status = 'PUBLISHED' WHERE id = 1");
    $stmt->execute([$id]);
    
    // Log in History
    $stmt = $db->prepare("INSERT INTO display_histories (display_type, record_id, title) VALUES ('HYMN', ?, ?)");
    $stmt->execute([$id, "Hymn #" . $h['hymn_number'] . ": " . $h['title']]);
    
    logActivity($db, $currUser['username'], 'DISPLAY_HYMN', "Displayed Hymn #" . $h['hymn_number'] . ": " . $h['title']);
    
    successResponse([
        'success' => true,
        'display' => [
            'displayType' => 'HYMN',
            'recordId' => (int)$id,
            'title' => "Hymn #" . $h['hymn_number'] . ": " . $h['title']
        ]
    ]);
}

// 7.3. ANNOUNCEMENT HANDLERS
function handleGetAnnouncements($db, $input) {
    $stmt = $db->query("SELECT * FROM announcements ORDER BY created_at DESC");
    $items = $stmt->fetchAll();
    
    foreach ($items as &$item) {
        $item['id'] = (int)$item['id'];
        $item['expiryDate'] = $item['expiry_date'];
        unset($item['expiry_date']);
    }
    
    successResponse($items);
}

function handleCreateAnnouncement($db, $input) {
    $currUser = authenticateToken();
    validateRequest($input, ['title' => 'required', 'body' => 'required']);
    
    $stmt = $db->prepare("INSERT INTO announcements (title, body, date, priority, expiry_date, status) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([
        $input['title'],
        $input['body'],
        $input['date'] ?? '',
        $input['priority'] ?? 'MEDIUM',
        $input['expiryDate'] ?? '',
        $input['status'] ?? 'PUBLISHED'
    ]);
    $newId = $db->lastInsertId();
    
    logActivity($db, $currUser['username'], 'CREATE_ANNOUNCEMENT', "Created announcement: " . $input['title']);
    
    successResponse([
        'id' => (int)$newId,
        'title' => $input['title']
    ], 201);
}

function handleUpdateAnnouncement($db, $input, $id) {
    $currUser = authenticateToken();
    validateRequest($input, ['title' => 'required', 'body' => 'required']);
    
    $stmt = $db->prepare("SELECT * FROM announcements WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        errorResponse("Announcement not found", 404);
    }
    
    $stmt = $db->prepare("UPDATE announcements SET title = ?, body = ?, date = ?, priority = ?, expiry_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([
        $input['title'],
        $input['body'],
        $input['date'] ?? '',
        $input['priority'] ?? 'MEDIUM',
        $input['expiryDate'] ?? '',
        $input['status'] ?? 'PUBLISHED',
        $id
    ]);
    
    logActivity($db, $currUser['username'], 'EDIT_ANNOUNCEMENT', "Edited announcement: " . $input['title']);
    successResponse(['id' => (int)$id, 'title' => $input['title']]);
}

function handleDeleteAnnouncement($db, $input, $id) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("SELECT title FROM announcements WHERE id = ?");
    $stmt->execute([$id]);
    $title = $stmt->fetchColumn();
    if (!$title) {
        errorResponse("Announcement not found", 404);
    }
    
    $stmt = $db->prepare("DELETE FROM announcements WHERE id = ?");
    $stmt->execute([$id]);
    
    logActivity($db, $currUser['username'], 'DELETE_ANNOUNCEMENT', "Deleted announcement ID: $id");
    successResponse(['success' => true]);
}

function handleDisplayAnnouncement($db, $input, $id) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("SELECT title FROM announcements WHERE id = ?");
    $stmt->execute([$id]);
    $title = $stmt->fetchColumn();
    if (!$title) {
        errorResponse("Announcement not found", 404);
    }
    
    $stmt = $db->prepare("UPDATE current_displays SET display_type = 'ANNOUNCEMENT', record_id = ?, last_updated = CURRENT_TIMESTAMP, status = 'PUBLISHED' WHERE id = 1");
    $stmt->execute([$id]);
    
    $stmt = $db->prepare("INSERT INTO display_histories (display_type, record_id, title) VALUES ('ANNOUNCEMENT', ?, ?)");
    $stmt->execute([$id, "Announcement: $title"]);
    
    logActivity($db, $currUser['username'], 'DISPLAY_ANNOUNCEMENT', "Displayed announcement: $title");
    successResponse(['success' => true]);
}

// 7.4. BIBLE CITATION HANDLERS
function handleGetCitations($db, $input) {
    $stmt = $db->query("SELECT * FROM citations ORDER BY created_at DESC");
    $items = $stmt->fetchAll();
    
    foreach ($items as &$item) {
        $item['id'] = (int)$item['id'];
        $item['chapter'] = (int)$item['chapter'];
        $item['displayText'] = $item['display_text'];
        unset($item['display_text']);
    }
    
    successResponse($items);
}

function handleCreateCitation($db, $input) {
    $currUser = authenticateToken();
    validateRequest($input, [
        'book' => 'required',
        'chapter' => 'required',
        'verse' => 'required',
        'displayText' => 'required'
    ]);
    
    $stmt = $db->prepare("INSERT INTO citations (book, chapter, verse, display_text, notes) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([
        $input['book'],
        $input['chapter'],
        $input['verse'],
        $input['displayText'],
        $input['notes'] ?? null
    ]);
    $newId = $db->lastInsertId();
    
    $label = $input['book'] . " " . $input['chapter'] . ":" . $input['verse'];
    logActivity($db, $currUser['username'], 'CREATE_CITATION', "Created bible citation: $label");
    
    successResponse([
        'id' => (int)$newId,
        'book' => $input['book'],
        'chapter' => (int)$input['chapter'],
        'verse' => $input['verse']
    ], 201);
}

function handleUpdateCitation($db, $input, $id) {
    $currUser = authenticateToken();
    validateRequest($input, [
        'book' => 'required',
        'chapter' => 'required',
        'verse' => 'required',
        'displayText' => 'required'
    ]);
    
    $stmt = $db->prepare("SELECT * FROM citations WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        errorResponse("Bible citation not found", 404);
    }
    
    $stmt = $db->prepare("UPDATE citations SET book = ?, chapter = ?, verse = ?, display_text = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([
        $input['book'],
        $input['chapter'],
        $input['verse'],
        $input['displayText'],
        $input['notes'] ?? null,
        $id
    ]);
    
    $label = $input['book'] . " " . $input['chapter'] . ":" . $input['verse'];
    logActivity($db, $currUser['username'], 'EDIT_CITATION', "Edited bible citation: $label");
    successResponse(['id' => (int)$id, 'book' => $input['book']]);
}

function handleDeleteCitation($db, $input, $id) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("SELECT book, chapter, verse FROM citations WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        errorResponse("Bible citation not found", 404);
    }
    
    $stmt = $db->prepare("DELETE FROM citations WHERE id = ?");
    $stmt->execute([$id]);
    
    $label = $row['book'] . " " . $row['chapter'] . ":" . $row['verse'];
    logActivity($db, $currUser['username'], 'DELETE_CITATION', "Deleted bible citation: $label");
    successResponse(['success' => true]);
}

function handleDisplayCitation($db, $input, $id) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("SELECT book, chapter, verse FROM citations WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        errorResponse("Bible citation not found", 404);
    }
    
    $label = $row['book'] . " " . $row['chapter'] . ":" . $row['verse'];
    
    $stmt = $db->prepare("UPDATE current_displays SET display_type = 'CITATION', record_id = ?, last_updated = CURRENT_TIMESTAMP, status = 'PUBLISHED' WHERE id = 1");
    $stmt->execute([$id]);
    
    $stmt = $db->prepare("INSERT INTO display_histories (display_type, record_id, title) VALUES ('CITATION', ?, ?)");
    $stmt->execute([$id, "Scripture: $label"]);
    
    logActivity($db, $currUser['username'], 'DISPLAY_CITATION', "Displayed Scripture: $label");
    successResponse(['success' => true]);
}

// 7.5. CUSTOM MESSAGE HANDLERS
function handleGetMessages($db, $input) {
    $stmt = $db->query("SELECT * FROM custom_messages ORDER BY created_at DESC");
    $items = $stmt->fetchAll();
    
    foreach ($items as &$item) {
        $item['id'] = (int)$item['id'];
    }
    
    successResponse($items);
}

function handleCreateMessage($db, $input) {
    $currUser = authenticateToken();
    validateRequest($input, [
        'type' => 'required',
        'title' => 'required',
        'body' => 'required'
    ]);
    
    $stmt = $db->prepare("INSERT INTO custom_messages (type, title, body) VALUES (?, ?, ?)");
    $stmt->execute([
        $input['type'],
        $input['title'],
        $input['body']
    ]);
    $newId = $db->lastInsertId();
    
    logActivity($db, $currUser['username'], 'CREATE_MESSAGE', "Created custom display slide: [" . $input['type'] . "] " . $input['title']);
    
    successResponse([
        'id' => (int)$newId,
        'title' => $input['title'],
        'type' => $input['type']
    ], 201);
}

function handleUpdateMessage($db, $input, $id) {
    $currUser = authenticateToken();
    validateRequest($input, [
        'type' => 'required',
        'title' => 'required',
        'body' => 'required'
    ]);
    
    $stmt = $db->prepare("SELECT * FROM custom_messages WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        errorResponse("Custom message display slide not found", 404);
    }
    
    $stmt = $db->prepare("UPDATE custom_messages SET type = ?, title = ?, body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    $stmt->execute([
        $input['type'],
        $input['title'],
        $input['body'],
        $id
    ]);
    
    logActivity($db, $currUser['username'], 'EDIT_MESSAGE', "Edited custom display slide: [" . $input['type'] . "] " . $input['title']);
    successResponse(['id' => (int)$id, 'title' => $input['title']]);
}

function handleDeleteMessage($db, $input, $id) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("SELECT title FROM custom_messages WHERE id = ?");
    $stmt->execute([$id]);
    $title = $stmt->fetchColumn();
    if (!$title) {
        errorResponse("Custom message display slide not found", 404);
    }
    
    $stmt = $db->prepare("DELETE FROM custom_messages WHERE id = ?");
    $stmt->execute([$id]);
    
    logActivity($db, $currUser['username'], 'DELETE_MESSAGE', "Deleted custom message slide ID: $id");
    successResponse(['success' => true]);
}

function handleDisplayMessage($db, $input, $id) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("SELECT type, title FROM custom_messages WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        errorResponse("Custom message display slide not found", 404);
    }
    
    $stmt = $db->prepare("UPDATE current_displays SET display_type = 'MESSAGE', record_id = ?, last_updated = CURRENT_TIMESTAMP, status = 'PUBLISHED' WHERE id = 1");
    $stmt->execute([$id]);
    
    $stmt = $db->prepare("INSERT INTO display_histories (display_type, record_id, title) VALUES ('MESSAGE', ?, ?)");
    $stmt->execute([$id, "Custom Message: " . $row['title']]);
    
    logActivity($db, $currUser['username'], 'DISPLAY_MESSAGE', "Displayed Custom Message: [" . $row['type'] . "] " . $row['title']);
    successResponse(['success' => true]);
}

function handleDisplayWelcome($db, $input) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("UPDATE current_displays SET display_type = 'WELCOME_SLIDE', record_id = 0, last_updated = CURRENT_TIMESTAMP, status = 'PUBLISHED' WHERE id = 1");
    $stmt->execute();
    
    logActivity($db, $currUser['username'], 'DISPLAY_WELCOME', "Reset live projection to default welcome screen");
    successResponse(['success' => true]);
}

// 7.6. SETTINGS HANDLERS
function handleGetSettings($db, $input) {
    $stmt = $db->prepare("SELECT value FROM settings WHERE key = ?");
    $stmt->execute(['branding_settings']);
    $val = $stmt->fetchColumn();
    
    if (!$val) {
        errorResponse("Branding and configuration settings not found", 404);
    }
    
    successResponse(json_decode($val, true));
}

function handleSaveSettings($db, $input) {
    $currUser = authenticateToken();
    
    $stmt = $db->prepare("INSERT INTO settings (key, value) VALUES ('branding_settings', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    $stmt->execute([json_encode($input)]);
    
    logActivity($db, $currUser['username'], 'UPDATE_SETTINGS', "Updated branding and church configuration settings");
    successResponse($input);
}

// 7.7. ACTIVITY LOGS & ANALYTICS HANDLERS
function handleGetLogs($db, $input) {
    authenticateToken();
    $stmt = $db->query("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100");
    $logs = $stmt->fetchAll();
    
    foreach ($logs as &$log) {
        $log['id'] = (int)$log['id'];
    }
    
    successResponse($logs);
}

function handleGetCurrentDisplay($db, $input) {
    $stmt = $db->query("SELECT * FROM current_displays WHERE id = 1");
    $rawDisplay = $stmt->fetch();
    
    if (!$rawDisplay) {
        successResponse([
            'id' => 1,
            'displayType' => 'WELCOME_SLIDE',
            'recordId' => 0,
            'lastUpdated' => date('c'),
            'status' => 'PUBLISHED',
            'data' => [
                'title' => 'Welcome to Church',
                'body' => 'Scan the QR code to participate!'
            ]
        ]);
    }
    
    $type = $rawDisplay['display_type'];
    $rId = (int)$rawDisplay['record_id'];
    $hydratedData = getHydratedDisplayData($db, $type, $rId);
    
    successResponse([
        'id' => 1,
        'displayType' => $type,
        'recordId' => $rId,
        'lastUpdated' => $rawDisplay['last_updated'],
        'status' => $rawDisplay['status'],
        'data' => $hydratedData
    ]);
}

function handleGetDisplayHistory($db, $input) {
    authenticateToken();
    $stmt = $db->query("SELECT * FROM display_histories ORDER BY displayed_at DESC LIMIT 20");
    $history = $stmt->fetchAll();
    
    foreach ($history as &$h) {
        $h['id'] = (int)$h['id'];
        $h['displayType'] = $h['display_type'];
        $h['recordId'] = (int)$h['record_id'];
        $h['displayedAt'] = $h['displayed_at'];
        unset($h['display_type'], $h['record_id'], $h['displayed_at']);
    }
    
    successResponse($history);
}

function handleGetStats($db, $input) {
    authenticateToken();
    
    $hymns = $db->query("SELECT COUNT(*) FROM hymns")->fetchColumn();
    $ann = $db->query("SELECT COUNT(*) FROM announcements")->fetchColumn();
    $cit = $db->query("SELECT COUNT(*) FROM citations")->fetchColumn();
    $msg = $db->query("SELECT COUNT(*) FROM custom_messages")->fetchColumn();
    $users = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    
    $recentHist = $db->query("SELECT * FROM display_histories ORDER BY displayed_at DESC LIMIT 5")->fetchAll();
    foreach ($recentHist as &$rh) {
        $rh['id'] = (int)$rh['id'];
        $rh['displayType'] = $rh['display_type'];
        $rh['recordId'] = (int)$rh['record_id'];
        $rh['displayedAt'] = $rh['displayed_at'];
        unset($rh['display_type'], $rh['record_id'], $rh['displayed_at']);
    }
    
    $recentLogs = $db->query("SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 5")->fetchAll();
    foreach ($recentLogs as &$rl) {
        $rl['id'] = (int)$rl['id'];
    }
    
    successResponse([
        'totalHymns' => (int)$hymns,
        'totalAnnouncements' => (int)$ann,
        'totalCitations' => (int)$cit,
        'totalMessages' => (int)$msg,
        'totalUsers' => (int)$users,
        'recentDisplay' => $recentHist,
        'recentLogs' => $recentLogs
    ]);
}

// 7.8. BACKUP & RESTORE
function handleBackup($db, $input) {
    $currUser = authenticateToken();
    
    $users = $db->query("SELECT id, username, email, password_hash, role FROM users")->fetchAll();
    $hymns = $db->query("SELECT * FROM hymns")->fetchAll();
    $announcements = $db->query("SELECT * FROM announcements")->fetchAll();
    $citations = $db->query("SELECT * FROM citations")->fetchAll();
    $custom_messages = $db->query("SELECT * FROM custom_messages")->fetchAll();
    $display_histories = $db->query("SELECT * FROM display_histories")->fetchAll();
    $current_displays = $db->query("SELECT * FROM current_displays")->fetchAll();
    $settingsRaw = $db->query("SELECT * FROM settings")->fetchAll();
    
    $settingsObj = [];
    foreach ($settingsRaw as $s) {
        $settingsObj[$s['key']] = json_decode($s['value'], true);
    }
    
    $backupData = [
        'users' => $users,
        'hymns' => array_map(function($r) {
            $r['id'] = (int)$r['id'];
            $r['hymnNumber'] = (int)$r['hymn_number'];
            unset($r['hymn_number']);
            return $r;
        }, $hymns),
        'announcements' => array_map(function($r) {
            $r['id'] = (int)$r['id'];
            $r['expiryDate'] = $r['expiry_date'];
            unset($r['expiry_date']);
            return $r;
        }, $announcements),
        'citations' => array_map(function($r) {
            $r['id'] = (int)$r['id'];
            $r['displayText'] = $r['display_text'];
            unset($r['display_text']);
            return $r;
        }, $citations),
        'custom_messages' => array_map(function($r) {
            $r['id'] = (int)$r['id'];
            return $r;
        }, $custom_messages),
        'display_histories' => array_map(function($r) {
            $r['id'] = (int)$r['id'];
            $r['displayType'] = $r['display_type'];
            $r['recordId'] = (int)$r['record_id'];
            $r['displayedAt'] = $r['displayed_at'];
            unset($r['display_type'], $r['record_id'], $r['displayed_at']);
            return $r;
        }, $display_histories),
        'current_display' => !empty($current_displays[0]) ? [
            'id' => (int)$current_displays[0]['id'],
            'displayType' => $current_displays[0]['display_type'],
            'recordId' => (int)$current_displays[0]['record_id'],
            'lastUpdated' => $current_displays[0]['last_updated'],
            'status' => $current_displays[0]['status']
        ] : null,
        'settings' => $settingsObj
    ];
    
    logActivity($db, $currUser['username'], 'DOWNLOAD_BACKUP', "Exported full SQLite database package");
    
    header('Content-disposition: attachment; filename=church_qr_backup_' . time() . '.json');
    header('Content-type: application/json');
    echo json_encode($backupData, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit();
}

function handleRestore($db, $input) {
    $currUser = authenticateToken();
    
    if (!$input || !is_array($input)) {
        errorResponse("Valid backup JSON payload is required", 400);
    }
    
    if (!isset($input['users']) || !isset($input['hymns']) || !isset($input['settings'])) {
        errorResponse("Invalid backup format structure", 400);
    }
    
    try {
        $db->beginTransaction();
        
        // Truncate Tables
        $db->exec("DELETE FROM users");
        $db->exec("DELETE FROM hymns");
        $db->exec("DELETE FROM announcements");
        $db->exec("DELETE FROM citations");
        $db->exec("DELETE FROM custom_messages");
        $db->exec("DELETE FROM settings");
        
        // Insert Users
        $stmt = $db->prepare("INSERT INTO users (id, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)");
        foreach ($input['users'] as $u) {
            $stmt->execute([
                $u['id'],
                $u['username'],
                $u['email'],
                $u['password_hash'] ?? $u['passwordHash'],
                $u['role']
            ]);
        }
        
        // Insert Hymns
        $stmt = $db->prepare("INSERT INTO hymns (id, hymn_number, title, lyrics, chorus, category, language) VALUES (?, ?, ?, ?, ?, ?, ?)");
        foreach ($input['hymns'] as $h) {
            $stmt->execute([
                $h['id'],
                $h['hymn_number'] ?? $h['hymnNumber'],
                $h['title'],
                $h['lyrics'],
                $h['chorus'] ?? null,
                $h['category'],
                $h['language'] ?? 'English'
            ]);
        }
        
        // Insert Announcements
        if (isset($input['announcements'])) {
            $stmt = $db->prepare("INSERT INTO announcements (id, title, body, date, priority, expiry_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
            foreach ($input['announcements'] as $a) {
                $stmt->execute([
                    $a['id'],
                    $a['title'],
                    $a['body'],
                    $a['date'] ?? '',
                    $a['priority'] ?? 'MEDIUM',
                    $a['expiry_date'] ?? $a['expiryDate'] ?? '',
                    $a['status'] ?? 'PUBLISHED'
                ]);
            }
        }
        
        // Insert Citations
        if (isset($input['citations'])) {
            $stmt = $db->prepare("INSERT INTO citations (id, book, chapter, verse, display_text, notes) VALUES (?, ?, ?, ?, ?, ?)");
            foreach ($input['citations'] as $c) {
                $stmt->execute([
                    $c['id'],
                    $c['book'],
                    $c['chapter'],
                    $c['verse'],
                    $c['display_text'] ?? $c['displayText'],
                    $c['notes'] ?? null
                ]);
            }
        }
        
        // Insert Messages
        if (isset($input['custom_messages'])) {
            $stmt = $db->prepare("INSERT INTO custom_messages (id, type, title, body) VALUES (?, ?, ?, ?)");
            foreach ($input['custom_messages'] as $m) {
                $stmt->execute([
                    $m['id'],
                    $m['type'],
                    $m['title'],
                    $m['body']
                ]);
            }
        }
        
        // Insert Settings
        if (isset($input['settings'])) {
            $stmt = $db->prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
            foreach ($input['settings'] as $key => $val) {
                $stmt->execute([
                    $key,
                    is_string($val) ? $val : json_encode($val)
                ]);
            }
        }
        
        // Insert Current Display
        if (isset($input['current_display'])) {
            $cd = $input['current_display'];
            $stmt = $db->prepare("UPDATE current_displays SET display_type = ?, record_id = ?, status = ? WHERE id = 1");
            $stmt->execute([
                $cd['displayType'] ?? $cd['display_type'],
                $cd['recordId'] ?? $cd['record_id'],
                $cd['status'] ?? 'PUBLISHED'
            ]);
        }
        
        $db->commit();
        
        logActivity($db, $currUser['username'], 'RESTORE_BACKUP', "Successfully restored database from uploaded backup file");
        successResponse(['success' => true, 'message' => 'Database successfully restored']);
        
    } catch (Exception $e) {
        $db->rollBack();
        errorResponse("Restore failed: " . $e->getMessage(), 500);
    }
}

// 7.9. SYSTEM HEALTH CHECK
function handleHealthCheck($db, $input) {
    successResponse([
        'status' => 'ok',
        'time' => date('c'),
        'database' => 'SQLite',
        'version' => 'PHP ' . PHP_VERSION,
        'environment' => 'Shared-Hosting Optimized'
    ]);
}
