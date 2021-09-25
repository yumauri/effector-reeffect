import { Node } from 'effector'

/**
 * Shortcut for smaller bundle size
 */
export const assign = Object.assign

/**
 * Helper from Effector's code, to add family links
 * https://github.com/effector/effector/blob/master/src/effector/own.ts
 */
export const own = (instance: any, links: { graphite: Node }[]) => {
  const owner = getGraph(instance)

  for (const _link of links) {
    const link = getGraph(_link)
    if (owner.family.type !== 'domain') link.family.type = 'crosslink'
    link.family.owners.push(owner)
    owner.family.links.push(link)
  }
}

/**
 * https://github.com/effector/effector/blob/master/src/effector/getter.ts
 */
export const getGraph = (graph: any): Node => graph.graphite || graph
