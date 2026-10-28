/**
 * Migraciones en orden. La posición en el arreglo es la versión (`PRAGMA user_version`).
 * Nunca se edita una migración ya aplicada: se agrega una nueva al final.
 */
export const migraciones: string[] = [
	/* 1 — esquema inicial */ `
	CREATE TABLE videos (
		id TEXT PRIMARY KEY,
		titulo TEXT NOT NULL,
		archivo_original TEXT NOT NULL,
		archivo_reproduccion TEXT,
		duracion_ms INTEGER,
		estado TEXT NOT NULL DEFAULT 'procesando'
			CHECK (estado IN ('procesando', 'listo', 'con_errores')),
		creado_en TEXT NOT NULL DEFAULT (datetime('now')),
		actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
	);

	-- Un registro por paso del procesamiento, para reintentar solo el que falló.
	CREATE TABLE video_pasos (
		video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
		paso TEXT NOT NULL,
		estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'en_curso', 'hecho', 'fallido')),
		error TEXT,
		actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
		PRIMARY KEY (video_id, paso)
	);

	-- Unidad de cita: 20 s o menos de transcripción con su minuto real.
	CREATE TABLE fragmentos (
		id INTEGER PRIMARY KEY,
		video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
		orden INTEGER NOT NULL,
		inicio_ms INTEGER NOT NULL,
		fin_ms INTEGER NOT NULL,
		hablante TEXT,
		texto TEXT NOT NULL,
		-- Texto normalizado y reducido a raíces; solo para buscar, nunca se muestra.
		texto_raiz TEXT NOT NULL,
		visibilidad TEXT NOT NULL DEFAULT 'visible'
			CHECK (visibilidad IN ('visible', 'pendiente', 'oculto')),
		UNIQUE (video_id, orden),
		CHECK (fin_ms >= inicio_ms)
	);
	CREATE INDEX fragmentos_video_inicio ON fragmentos (video_id, inicio_ms);

	CREATE VIRTUAL TABLE fragmentos_raices USING fts5 (
		texto_raiz,
		content = 'fragmentos', content_rowid = 'id',
		tokenize = 'unicode61 remove_diacritics 2'
	);
	CREATE VIRTUAL TABLE fragmentos_trigramas USING fts5 (
		texto,
		content = 'fragmentos', content_rowid = 'id',
		tokenize = 'trigram remove_diacritics 1'
	);

	CREATE TRIGGER fragmentos_ai AFTER INSERT ON fragmentos BEGIN
		INSERT INTO fragmentos_raices (rowid, texto_raiz) VALUES (new.id, new.texto_raiz);
		INSERT INTO fragmentos_trigramas (rowid, texto) VALUES (new.id, new.texto);
	END;
	CREATE TRIGGER fragmentos_ad AFTER DELETE ON fragmentos BEGIN
		INSERT INTO fragmentos_raices (fragmentos_raices, rowid, texto_raiz)
			VALUES ('delete', old.id, old.texto_raiz);
		INSERT INTO fragmentos_trigramas (fragmentos_trigramas, rowid, texto)
			VALUES ('delete', old.id, old.texto);
	END;
	CREATE TRIGGER fragmentos_au AFTER UPDATE OF texto, texto_raiz ON fragmentos BEGIN
		INSERT INTO fragmentos_raices (fragmentos_raices, rowid, texto_raiz)
			VALUES ('delete', old.id, old.texto_raiz);
		INSERT INTO fragmentos_trigramas (fragmentos_trigramas, rowid, texto)
			VALUES ('delete', old.id, old.texto);
		INSERT INTO fragmentos_raices (rowid, texto_raiz) VALUES (new.id, new.texto_raiz);
		INSERT INTO fragmentos_trigramas (rowid, texto) VALUES (new.id, new.texto);
	END;

	-- Lo que aparece en pantalla (diapositivas, pizarra) con su momento.
	CREATE TABLE en_pantalla (
		id INTEGER PRIMARY KEY,
		video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
		momento_ms INTEGER NOT NULL,
		texto TEXT NOT NULL,
		creado_en TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX en_pantalla_video ON en_pantalla (video_id, momento_ms);

	-- Pasajes bíblicos ya validados contra el canon.
	CREATE TABLE pasajes (
		id INTEGER PRIMARY KEY,
		video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
		libro TEXT NOT NULL,
		capitulo INTEGER NOT NULL,
		versiculo_inicio INTEGER,
		versiculo_fin INTEGER,
		momento_ms INTEGER NOT NULL,
		origen TEXT NOT NULL CHECK (origen IN ('dicho', 'en_pantalla')),
		fragmento_id INTEGER REFERENCES fragmentos(id) ON DELETE SET NULL,
		creado_en TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX pasajes_libro ON pasajes (libro, capitulo, versiculo_inicio);

	-- Propuestas de la IA y segmentos sensibles pendientes de decisión humana.
	CREATE TABLE pendientes (
		id INTEGER PRIMARY KEY,
		tipo TEXT NOT NULL CHECK (tipo IN ('resumen', 'temas', 'fragmento_sensible')),
		video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
		fragmento_id INTEGER REFERENCES fragmentos(id) ON DELETE CASCADE,
		categoria TEXT,
		contenido TEXT NOT NULL,
		estado TEXT NOT NULL DEFAULT 'pendiente'
			CHECK (estado IN ('pendiente', 'aprobado', 'oculto')),
		decidido_por TEXT,
		decidido_en TEXT,
		creado_en TEXT NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX pendientes_estado ON pendientes (estado, video_id);

	-- Cada llamada a la API con su uso y costo estimado, para el tope diario.
	CREATE TABLE gasto (
		id INTEGER PRIMARY KEY,
		momento TEXT NOT NULL DEFAULT (datetime('now')),
		modelo TEXT NOT NULL,
		operacion TEXT NOT NULL,
		tokens_entrada INTEGER NOT NULL DEFAULT 0,
		tokens_cache INTEGER NOT NULL DEFAULT 0,
		tokens_salida INTEGER NOT NULL DEFAULT 0,
		segundos_audio INTEGER NOT NULL DEFAULT 0,
		costo_usd REAL NOT NULL
	);
	CREATE INDEX gasto_momento ON gasto (momento);
	`
];
