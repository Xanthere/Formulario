import fs from 'fs';
import path from 'path';

// Define the path for local database file
const LOCAL_DB_DIR = path.join(process.cwd(), 'data');
const LOCAL_DB_PATH = path.join(LOCAL_DB_DIR, 'tasks.json');

// Initialize local database file if it doesn't exist
function initLocalDb() {
  if (!fs.existsSync(LOCAL_DB_DIR)) {
    fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Helper to read local DB
function readLocalDb() {
  try {
    initLocalDb();
    const data = fs.readFileSync(LOCAL_DB_PATH, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('Error reading local JSON database:', error);
    // If running in Vercel serverless and it fails due to read-only fs, we use /tmp
    try {
      const tempPath = '/tmp/tasks.json';
      if (fs.existsSync(tempPath)) {
        return JSON.parse(fs.readFileSync(tempPath, 'utf-8') || '[]');
      }
    } catch (e) {
      console.error('Error reading from temp path:', e);
    }
    return [];
  }
}

// Helper to write local DB
function writeLocalDb(data) {
  try {
    initLocalDb();
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error writing to local JSON database:', error);
    // Vercel serverless environment fallback to /tmp
    try {
      const tempPath = '/tmp/tasks.json';
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('Error writing to temp path:', e);
    }
    return false;
  }
}

export async function getTasks() {
  // 1. Check if Vercel Postgres is available
  if (process.env.POSTGRES_URL) {
    try {
      const { sql } = await import('@vercel/postgres');
      // Create table if it doesn't exist
      await sql`
        CREATE TABLE IF NOT EXISTS tasks (
          id VARCHAR(255) PRIMARY KEY,
          solicitante TEXT NOT NULL,
          area TEXT NOT NULL,
          necesidad TEXT NOT NULL,
          fecha_limite VARCHAR(50) NOT NULL,
          descripcion TEXT NOT NULL,
          prioridad VARCHAR(50) NOT NULL,
          estado VARCHAR(50) NOT NULL,
          created_at VARCHAR(100) NOT NULL
        );
      `;
      const { rows } = await sql`SELECT * FROM tasks ORDER BY created_at DESC;`;
      return rows.map(row => ({
        id: row.id,
        solicitante: row.solicitante,
        area: row.area,
        necesidad: row.necesidad,
        fechaLimite: row.fecha_limite,
        descripcion: row.descripcion,
        prioridad: row.prioridad,
        estado: row.estado,
        createdAt: row.created_at
      }));
    } catch (dbError) {
      console.error('Vercel Postgres Error, falling back:', dbError);
    }
  }

  // 2. Check if Vercel KV is available
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv');
      const tasks = await kv.get('tasks');
      return tasks || [];
    } catch (kvError) {
      console.error('Vercel KV Error, falling back:', kvError);
    }
  }

  // 3. Local fallback (Development/Serverless without DB setup)
  return readLocalDb();
}

export async function createTask(taskData) {
  const newTask = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    solicitante: taskData.solicitante,
    area: taskData.area,
    necesidad: taskData.necesidad,
    fechaLimite: taskData.fechaLimite,
    descripcion: taskData.descripcion,
    prioridad: taskData.prioridad || 'media',
    estado: taskData.estado || 'en proceso',
    createdAt: new Date().toISOString()
  };

  // 1. Check if Vercel Postgres is available
  if (process.env.POSTGRES_URL) {
    try {
      const { sql } = await import('@vercel/postgres');
      await sql`
        INSERT INTO tasks (id, solicitante, area, necesidad, fecha_limite, descripcion, prioridad, estado, created_at)
        VALUES (${newTask.id}, ${newTask.solicitante}, ${newTask.area}, ${newTask.necesidad}, ${newTask.fechaLimite}, ${newTask.descripcion}, ${newTask.prioridad}, ${newTask.estado}, ${newTask.createdAt});
      `;
      return newTask;
    } catch (dbError) {
      console.error('Vercel Postgres insert error, falling back:', dbError);
    }
  }

  // 2. Check if Vercel KV is available
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv');
      const tasks = await kv.get('tasks') || [];
      tasks.unshift(newTask); // Add to the beginning
      await kv.set('tasks', tasks);
      return newTask;
    } catch (kvError) {
      console.error('Vercel KV insert error, falling back:', kvError);
    }
  }

  // 3. Local fallback
  const tasks = readLocalDb();
  tasks.unshift(newTask);
  writeLocalDb(tasks);
  return newTask;
}

export async function updateTask(id, updates) {
  // 1. Check if Vercel Postgres is available
  if (process.env.POSTGRES_URL) {
    try {
      const { sql } = await import('@vercel/postgres');
      if (updates.prioridad !== undefined) {
        await sql`UPDATE tasks SET prioridad = ${updates.prioridad} WHERE id = ${id};`;
      }
      if (updates.estado !== undefined) {
        await sql`UPDATE tasks SET estado = ${updates.estado} WHERE id = ${id};`;
      }
      if (updates.fechaLimite !== undefined) {
        await sql`UPDATE tasks SET fecha_limite = ${updates.fechaLimite} WHERE id = ${id};`;
      }
      
      const { rows } = await sql`SELECT * FROM tasks WHERE id = ${id};`;
      if (rows.length > 0) {
        const row = rows[0];
        return {
          id: row.id,
          solicitante: row.solicitante,
          area: row.area,
          necesidad: row.necesidad,
          fechaLimite: row.fecha_limite,
          descripcion: row.descripcion,
          prioridad: row.prioridad,
          estado: row.estado,
          createdAt: row.created_at
        };
      }
    } catch (dbError) {
      console.error('Vercel Postgres update error, falling back:', dbError);
    }
  }

  // 2. Check if Vercel KV is available
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv } = await import('@vercel/kv');
      const tasks = await kv.get('tasks') || [];
      let updatedTask = null;
      const updatedTasks = tasks.map(task => {
        if (task.id === id) {
          updatedTask = { ...task, ...updates };
          return updatedTask;
        }
        return task;
      });
      if (updatedTask) {
        await kv.set('tasks', updatedTasks);
      }
      return updatedTask;
    } catch (kvError) {
      console.error('Vercel KV update error, falling back:', kvError);
    }
  }

  // 3. Local fallback
  const tasks = readLocalDb();
  let updatedTask = null;
  const updatedTasks = tasks.map(task => {
    if (task.id === id) {
      updatedTask = { ...task, ...updates };
      return updatedTask;
    }
    return task;
  });
  if (updatedTask) {
    writeLocalDb(updatedTasks);
  }
  return updatedTask;
}
