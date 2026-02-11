import express, { Request, Response } from 'express';
import Task from '../models/Task';
import validationService from '../services/validationService';

const router = express.Router();

/**
 * PATCH /api/tasks/:taskId/complete
 * Mark a task as completed
 *
 * This endpoint updates the task status and recalculates dependent task statuses
 */
router.patch('/:taskId/complete', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    // Find the task
    const task = await Task.findOne({ taskId });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: { message: 'Task not found' },
      });
    }

    // Update task status to completed
    task.status = 'completed';
    await task.save();

    // Get all tasks for this transcript
    const allTasks = await Task.find({ transcriptId: task.transcriptId });

    // Calculate which tasks are now ready
    const completedTaskIds = new Set(
      allTasks.filter(t => t.status === 'completed').map(t => t.taskId)
    );

    // Update dependent tasks
    const tasksToUpdate = allTasks
      .filter(t => t.status !== 'completed' && t.status !== 'error')
      .map(t => ({
        id: t.taskId,
        description: t.description,
        priority: t.priority,
        dependencies: t.dependencies,
        status: t.status as 'ready' | 'blocked',
      }));

    const updatedTasks = validationService.calculateTaskStatuses(
      tasksToUpdate,
      completedTaskIds
    );

    // Save updated tasks
    for (const updatedTask of updatedTasks) {
      await Task.findOneAndUpdate(
        { taskId: updatedTask.id },
        { status: updatedTask.status }
      );
    }

    // Return updated task list
    const finalTasks = await Task.find({ transcriptId: task.transcriptId });

    res.json({
      success: true,
      message: 'Task marked as completed',
      data: {
        completedTask: task,
        allTasks: finalTasks,
      },
    });
  } catch (error: any) {
    console.error('Error completing task:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to complete task' },
    });
  }
});

/**
 * GET /api/tasks/transcript/:transcriptId
 * Get all tasks for a specific transcript
 */
router.get('/transcript/:transcriptId', async (req: Request, res: Response) => {
  try {
    const { transcriptId } = req.params;

    const tasks = await Task.find({ transcriptId });

    res.json({
      success: true,
      data: {
        tasks,
        count: tasks.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch tasks' },
    });
  }
});

export default router;
