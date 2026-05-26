import { NextResponse } from 'next/server';
import { getTasks, createTask, updateTask, deleteTask } from '@/lib/db';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'formulario-super-secret-key-123456';

// Middleware-like function to verify if user is authenticated
async function isAuthenticated() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return false;
    
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

// GET all tasks
export async function GET() {
  try {
    const tasks = await getTasks();
    return NextResponse.json(tasks, { status: 200 });
  } catch (error) {
    console.error('Error fetching tasks API:', error);
    return NextResponse.json({ error: 'Error al obtener las tareas' }, { status: 500 });
  }
}

// POST create new task
export async function POST(request) {
  try {
    const body = await request.json();
    const { solicitante, area, necesidad, fechaLimite, descripcion } = body;

    // Validation
    if (!solicitante || !area || !necesidad || !fechaLimite || !descripcion) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios' }, { status: 400 });
    }

    // Default status & priority
    const priority = 'media';
    const status = 'en proceso';

    const newTask = await createTask({
      solicitante,
      area,
      necesidad,
      fechaLimite,
      descripcion,
      prioridad: priority,
      estado: status
    });

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Error creating task API:', error);
    return NextResponse.json({ error: 'Error al crear la tarea' }, { status: 500 });
  }
}

// PUT update task priority and/or status
export async function PUT(request) {
  try {
    // 1. Verify user is logged in
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'No autorizado. Debe iniciar sesión.' }, { status: 401 });
    }

    const body = await request.json();
    const { id, prioridad, estado, fechaLimite } = body;

    if (!id) {
      return NextResponse.json({ error: 'El ID de la tarea es requerido' }, { status: 400 });
    }

    const updates = {};
    if (prioridad !== undefined) updates.prioridad = prioridad;
    if (estado !== undefined) updates.estado = estado;
    if (fechaLimite !== undefined) updates.fechaLimite = fechaLimite;

    const updatedTask = await updateTask(id, updates);
    if (!updatedTask) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (error) {
    console.error('Error updating task API:', error);
    return NextResponse.json({ error: 'Error al actualizar la tarea' }, { status: 500 });
  }
}

// DELETE task
export async function DELETE(request) {
  try {
    // 1. Verify user is logged in
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: 'No autorizado. Debe iniciar sesión.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'El ID de la tarea es requerido' }, { status: 400 });
    }

    const success = await deleteTask(id);
    if (!success) {
      return NextResponse.json({ error: 'No se pudo eliminar la tarea' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Tarea eliminada' }, { status: 200 });
  } catch (error) {
    console.error('Error deleting task API:', error);
    return NextResponse.json({ error: 'Error al eliminar la tarea' }, { status: 500 });
  }
}
