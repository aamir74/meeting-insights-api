import { ValidatedTask } from './validationService';

export interface CycleDetectionResult {
  hasCycles: boolean;
  cycleNodes: Set<string>;
  tasks: ValidatedTask[];
}

/**
 * Cycle Detection Service using Depth-First Search (DFS)
 *
 * Algorithm:
 * 1. For each unvisited node, start a DFS traversal
 * 2. Maintain two sets:
 *    - visited: nodes that have been fully explored
 *    - recursionStack: nodes in the current DFS path
 * 3. If we encounter a node that's in the recursion stack, we've found a cycle
 * 4. Mark all nodes in detected cycles as "error" status
 */
export class CycleDetectionService {
  /**
   * Detects cycles in the task dependency graph
   */
  detectCycles(tasks: ValidatedTask[]): CycleDetectionResult {
    // Build adjacency list for the graph
    const graph = this.buildGraph(tasks);
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycleNodes = new Set<string>();

    // Run DFS from each unvisited node
    for (const taskId of graph.keys()) {
      if (!visited.has(taskId)) {
        this.dfs(taskId, graph, visited, recursionStack, cycleNodes);
      }
    }

    // Mark tasks in cycles as error
    const updatedTasks = tasks.map(task => {
      if (cycleNodes.has(task.id)) {
        return {
          ...task,
          status: 'error' as const,
          errorMessage: 'This task is part of a circular dependency',
        };
      }
      return task;
    });

    return {
      hasCycles: cycleNodes.size > 0,
      cycleNodes,
      tasks: updatedTasks,
    };
  }

  /**
   * Builds an adjacency list representation of the dependency graph
   */
  private buildGraph(tasks: ValidatedTask[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    // Initialize graph with all task IDs
    tasks.forEach(task => {
      graph.set(task.id, task.dependencies || []);
    });

    return graph;
  }

  /**
   * Depth-First Search to detect cycles
   *
   * @param node - Current node being visited
   * @param graph - Adjacency list representation
   * @param visited - Set of fully explored nodes
   * @param recursionStack - Current DFS path (for cycle detection)
   * @param cycleNodes - Set to store all nodes involved in cycles
   * @returns true if a cycle is detected
   */
  private dfs(
    node: string,
    graph: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>,
    cycleNodes: Set<string>
  ): boolean {
    // Mark node as being in current path
    visited.add(node);
    recursionStack.add(node);

    // Get dependencies (neighbors)
    const neighbors = graph.get(node) || [];

    // Explore each dependency
    for (const neighbor of neighbors) {
      // If neighbor is not visited, recursively visit it
      if (!visited.has(neighbor)) {
        if (this.dfs(neighbor, graph, visited, recursionStack, cycleNodes)) {
          // Cycle detected - add current node to cycle
          cycleNodes.add(node);
          return true;
        }
      }
      // If neighbor is in recursion stack, we found a cycle
      else if (recursionStack.has(neighbor)) {
        cycleNodes.add(node);
        cycleNodes.add(neighbor);
        return true;
      }
    }

    // Remove node from recursion stack as we backtrack
    recursionStack.delete(node);
    return false;
  }

  /**
   * Performs topological sort to get a valid task execution order
   * Only works if there are no cycles
   */
  topologicalSort(tasks: ValidatedTask[]): string[] | null {
    const graph = this.buildGraph(tasks);
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const result: string[] = [];

    // Helper function for DFS-based topological sort
    const dfsSort = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (!dfsSort(neighbor)) {
            return false; // Cycle detected
          }
        } else if (recursionStack.has(neighbor)) {
          return false; // Cycle detected
        }
      }

      recursionStack.delete(node);
      result.push(node);
      return true;
    };

    // Process all nodes
    for (const taskId of graph.keys()) {
      if (!visited.has(taskId)) {
        if (!dfsSort(taskId)) {
          return null; // Cycle detected
        }
      }
    }

    return result.reverse(); // Reverse to get correct order
  }
}

export default new CycleDetectionService();
