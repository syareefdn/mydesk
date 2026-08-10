<?php
/**
 * Database Connection Class
 * Koneksi ke Database SLIMS Bulian 9
 */

class Database {
    private static ?Database $instance = null;
    private PDO $connection;
    private bool $connected = false;

    private function __construct() {
        $this->connect();
    }

    public static function getInstance(): Database {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    private function connect(): void {
        try {
            $dsn = sprintf(
                "mysql:host=%s;port=%d;dbname=%s;charset=%s",
                SLIMS_HOST,
                SLIMS_PORT,
                SLIMS_DATABASE,
                SLIMS_CHARSET
            );

            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => false,
            ];

            $this->connection = new PDO(
                $dsn,
                SLIMS_USERNAME,
                SLIMS_PASSWORD,
                $options
            );

            $this->connected = true;
        } catch (PDOException $e) {
            $this->connected = false;
            error_log("Database Connection Error: " . $e->getMessage());
            throw new Exception("Tidak dapat terhubung ke database SLIMS");
        }
    }

    public function getConnection(): PDO {
        if (!$this->connected) {
            $this->connect();
        }
        return $this->connection;
    }

    public function isConnected(): bool {
        return $this->connected;
    }

    public function query(string $sql, array $params = []): array {
        try {
            $stmt = $this->getConnection()->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            error_log("Query Error: " . $e->getMessage());
            return [];
        }
    }

    public function queryOne(string $sql, array $params = []): ?array {
        $results = $this->query($sql, $params);
        return $results[0] ?? null;
    }

    public function execute(string $sql, array $params = []): int {
        try {
            $stmt = $this->getConnection()->prepare($sql);
            $stmt->execute($params);
            return $stmt->rowCount();
        } catch (PDOException $e) {
            error_log("Execute Error: " . $e->getMessage());
            return 0;
        }
    }

    public function lastInsertId(): string {
        return $this->getConnection()->lastInsertId();
    }
}
