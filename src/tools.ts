import { Node as Step } from 'effector'

/**
 * Shortcut for smaller bundle size
 */
export const assign = Object.assign

/**
 * Helper from Effector's code, to add family links
 * https://github.com/zerobias/effector/blob/master/src/effector/stdlib/family.js
 */
export const own = (
  { graphite: owner }: { graphite: Step },
  links: { graphite: Step }[]
) => {
  for (const { graphite } of links) {
    graphite.family.type = 'crosslink'
    graphite.family.owners.push(owner)
    owner.family.links.push(graphite)
  }
}

/**
 * Helper from Effector's code, to set meta of the fields
 * https://github.com/effector/effector/blob/master/src/effector/getter.ts
 */
export const setMeta = (
  unit: { graphite: Step },
  field: string,
  value: any
) => {
  unit.graphite.meta[field] = value
}
