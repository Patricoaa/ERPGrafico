import { describe, expect, it } from 'vitest'
import { getStepCapabilities } from '../stepGovernance'
import type { WorkOrder } from '../../types'

const order = (patch: Partial<WorkOrder>): WorkOrder => ({ status: 'IN_PROGRESS', ...patch } as WorkOrder)

describe('getStepCapabilities', () => {
    it('does not block a rewind because of completed approvals or manual materials', () => {
        const caps = getStepCapabilities('MATERIAL_ASSIGNMENT', order({
            side_effects: {
                has_confirmed_pos: false,
                has_stock_movements: false,
                completed_tasks_count: 2,
                manually_edited_materials_count: 3,
                rewind_blockers: [],
            },
        }))
        expect(caps.canRewind).toBe(true)
    })

    it('blocks the rewind with the server reason when irreversible effects exist', () => {
        const caps = getStepCapabilities('PREPRESS', order({
            side_effects: {
                has_confirmed_pos: true,
                has_stock_movements: false,
                completed_tasks_count: 2,
                manually_edited_materials_count: 0,
                rewind_blockers: ['Existen Órdenes de Compra confirmadas.'],
            },
        }))
        expect(caps.canRewind).toBe(false)
        expect(caps.rewindBlockedReason).toContain('Órdenes de Compra')
        expect(caps.canEdit).toBe(false)
        expect(caps.editBlockedReason).toBeTruthy()
    })

    it('lets outsourcing be edited in place until its purchase orders exist', () => {
        const clean = { has_confirmed_pos: false, has_stock_movements: false, completed_tasks_count: 1, manually_edited_materials_count: 0, rewind_blockers: [] }
        expect(getStepCapabilities('OUTSOURCING_ASSIGNMENT', order({ side_effects: clean })).canEdit).toBe(true)
    })

    it('only blocks reopening the stages the purchase orders depend on', () => {
        const se = {
            has_confirmed_pos: true,
            has_stock_movements: false,
            completed_tasks_count: 3,
            manually_edited_materials_count: 0,
            rewind_blockers: ['Existen Órdenes de Compra confirmadas para servicios tercerizados.'],
            rewind_blockers_by_stage: {
                MATERIAL_ASSIGNMENT: ['Existen Órdenes de Compra confirmadas para servicios tercerizados.'],
                OUTSOURCING_ASSIGNMENT: ['Existen Órdenes de Compra confirmadas para servicios tercerizados.'],
                PREPRESS: [],
                PRESS: [],
            },
        }
        const o = order({ current_stage: 'POSTPRESS', side_effects: se })
        expect(getStepCapabilities('PRESS', o).canRewind).toBe(true)
        expect(getStepCapabilities('OUTSOURCING_ASSIGNMENT', o).canRewind).toBe(false)
    })
})
