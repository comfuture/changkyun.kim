import * as blessedModule from "blessed"

export const blessed = (blessedModule as any).default ?? blessedModule
