declare module 'react-big-calendar' {
    import { ComponentType } from 'react';

    export type View = 'month' | 'week' | 'work_week' | 'day' | 'agenda';

    export interface SlotInfo {
        start: Date;
        end: Date;
        slots: Date[];
        action: 'select' | 'click' | 'doubleClick';
    }

    export interface Components<TEvent extends object = Event, TResource extends object = object> {
        [key: string]: any;
    }

    export interface CalendarProps<TEvent extends object = Event, TResource extends object = object> {
        localizer: any;
        components?: Components;
        [key: string]: any;
    }

    export class Calendar<TEvent extends object = Event, TResource extends object = object> extends React.Component<CalendarProps<TEvent, TResource>> { }

    export const momentLocalizer: (momentInstance: any) => any;
    export const globalizeLocalizer: (globalizeInstance: any) => any;
    export const dateFnsLocalizer: (config: any) => any;
    export const luxonLocalizer: (luxonDateTime: any) => any;
}
