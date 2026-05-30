export interface CategoryTreeNode {
  id: string;
  name: string;
  children?: CategoryTreeNode[];
}

export function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  depth = 0,
): Array<{ id: string; label: string }> {
  const rows: Array<{ id: string; label: string }> = [];
  for (const node of nodes) {
    const prefix = depth > 0 ? `${'—'.repeat(depth)} ` : '';
    rows.push({ id: node.id, label: `${prefix}${node.name}` });
    if (node.children?.length) {
      rows.push(...flattenCategoryTree(node.children, depth + 1));
    }
  }
  return rows;
}
