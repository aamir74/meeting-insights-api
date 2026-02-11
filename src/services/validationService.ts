import { TaskOutput } from './llmService';

export interface ValidatedTask extends TaskOutput {
  status: 'ready' | 'blocked' | 'error';
  errorMessage?: string;
  sanitizedDependencies?: string[];
}

export class ValidationService {
  /**
   * Validates and sanitizes task dependencies
   * Removes any dependency IDs that don't exist in the task list
   */
  validateAndSanitizeTasks(tasks: TaskOutput[]): ValidatedTask[] {
    // Create a set of valid task IDs for O(1) lookup
    const validTaskIds = new Set(tasks.map(task => task.id));

    // Sanitize each task's dependencies
    const sanitizedTasks: ValidatedTask[] = tasks.map(task => {
      const originalDependencies = task.dependencies || [];
      const validDependencies: string[] = [];
      const invalidDependencies: string[] = [];

      // Check each dependency
      originalDependencies.forEach(depId => {
        if (validTaskIds.has(depId)) {
          validDependencies.push(depId);
        } else {
          invalidDependencies.push(depId);
        }
      });

      // Log warning if invalid dependencies were found
      if (invalidDependencies.length > 0) {
        console.warn(
          `Task "${task.id}" had invalid dependencies removed:`,
          invalidDependencies
        );
      }

      return {
        ...task,
        dependencies: validDependencies,
        sanitizedDependencies: invalidDependencies.length > 0 ? invalidDependencies : undefined,
        status: 'ready', // Will be updated by cycle detection
      };
    });

    return sanitizedTasks;
  }

  /**
   * Calculates which tasks are ready to start (no pending dependencies)
   */
  calculateTaskStatuses(
    tasks: ValidatedTask[],
    completedTaskIds: Set<string> = new Set()
  ): ValidatedTask[] {
    return tasks.map(task => {
      // Skip if task is in error state
      if (task.status === 'error') {
        return task;
      }

      // Check if all dependencies are completed
      const hasUnmetDependencies = task.dependencies.some(
        depId => !completedTaskIds.has(depId)
      );

      return {
        ...task,
        status: hasUnmetDependencies ? 'blocked' : 'ready',
      };
    });
  }

  /**
   * Validates that tasks have required fields
   */
  validateTaskStructure(tasks: any[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(tasks)) {
      errors.push('Tasks must be an array');
      return { valid: false, errors };
    }

    tasks.forEach((task, index) => {
      if (!task.id) {
        errors.push(`Task at index ${index} is missing 'id' field`);
      }
      if (!task.description) {
        errors.push(`Task at index ${index} is missing 'description' field`);
      }
      if (task.priority && !['high', 'medium', 'low'].includes(task.priority)) {
        errors.push(
          `Task at index ${index} has invalid priority: ${task.priority}`
        );
      }
      if (task.dependencies && !Array.isArray(task.dependencies)) {
        errors.push(`Task at index ${index} has invalid dependencies (must be array)`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default new ValidationService();
