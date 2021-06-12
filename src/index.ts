import { useEffect, useCallback } from 'react';
import {
  createSlice,
  createSelector,
  CreateSliceOptions,
  SliceCaseReducers,
  Dispatch,
  OutputSelector,
  ActionCreatorWithoutPayload,
  Slice,
} from '@reduxjs/toolkit';
import { useSelector, useDispatch } from 'react-redux';
import deepEqual from 'deep-equal';

/**
 * State attributes provided for base monitored slice.
 */
export interface IMonitoredState<IDataType> {
  stale: boolean;
  loading: boolean;
  data: IDataType;
}

/**
 * Actions provided for base monitored slice.
 */
export interface IMonitoredActions {
  /**
   * Mark slice data as stale.
   */
  makeStale: ActionCreatorWithoutPayload;
}

/**
 * Configuration options for monitored slice.
 */
interface IMonitoredSliceOptions {
  /**
   * If true, data is reset to initial data when marked as stale. Default: false
   */
  resetOnStale?: boolean;

  /**
   * If true, initial data is returned during loading. Default: false
   */
  resetOnLoading?: boolean;
}

/**
 * Object returned from useMonitoredData hook.
 */
export interface IUseMonitoredData<IDataType> {
  /**
   * Slice's data
   */
  data: IDataType;

  /**
   * True if the data is stale or loading
   */
  loading: boolean;

  /**
   * Mark slice as stale.
   */
  makeStale: () => void;
}

/**
 * Object returned when creating a monitored slice.
 */
export interface IMonitoredSlice<IRootState, IState, IDataType> {
  /**
   * The actual slice.
   */
  slice: Slice<IState>;

  /**
   * Selectors for accessing different slice data/metadata.
   */
  selectors: {
    /**
     * Selects the entire slice.
     */
    selectSlice: OutputSelector<IRootState, IState, (res: IState) => IState>;

    /**
     * Selects if the slice data is stale.
     */
    selectStale: OutputSelector<IRootState, boolean, (res: IState) => boolean>;

    /**
     * Selects if the slice data is loading.
     */
    selectLoading: OutputSelector<
      IRootState,
      boolean,
      (res: IState) => boolean
    >;

    /**
     * Selects the slice data or initial data based on configuration.
     */
    selectData: OutputSelector<
      IRootState,
      IDataType,
      (res1: IState, res2: boolean, res3: boolean) => IDataType
    >;
  };

  /**
   * Hooks that are provided for interacting with the slice.
   */
  hooks: {
    /**
     * Monitors a slice. If nothing is actively using this hook for a slice, its data won't be loaded when stale.
     */
    useMonitoredData: () => IUseMonitoredData<IDataType>;
  };
}

/**
 * Creates a monitored slice which can load, provide, and make stale data based on other data within the Redux store.
 * Data is only fetched when stale and the slice is actively being monitored.
 * @param options Monitored slice and create slice options
 * @param initialData Initial value for data and (optionally) used when stale or loading
 * @param loader Function to load data based on params
 * @param loaderParamsSelector Selector which returns loader params
 * @returns New monitored slice
 */
export function createMonitoredSlice<
  IRootState,
  IDataType,
  IState extends IMonitoredState<IDataType>,
  ILoaderParams = unknown
>(
  options: IMonitoredSliceOptions &
    CreateSliceOptions<Omit<IState, 'stale' | 'loading' | 'data'>>,
  initialData: IDataType,
  loader: (params: ILoaderParams) => Promise<IDataType>,
  loaderParamsSelector: OutputSelector<
    IRootState,
    any,
    (R: any) => ILoaderParams
  > | null = null
): IMonitoredSlice<IRootState, IState, IDataType> {
  const slice = createSlice<IState, SliceCaseReducers<IState>>({
    name: options.name,
    initialState: {
      ...options.initialState,
      stale: true,
      loading: false,
      data: initialData,
    } as IState,
    reducers: {
      ...options.reducers,
      makeStale: (state) => {
        state.stale = true;
        if (options.resetOnStale) {
          state.data = initialData as any;
        }
      },
      makeLoading: (state) => {
        state.loading = true;
      },
      fulfill: (state, action) => {
        state.stale = false;
        state.loading = false;
        state.data = action.payload.data;
      },
    },
  });

  /**
   * Selector which returns the entire slice.
   */
  const selectSlice = createSelector<IRootState, IState, IState>(
    (state) => (state as any)[options.name] as IState,
    (slice) => slice
  );

  const selectNull = createSelector(
    () => null,
    () => null
  );

  /**
   * Selector which returns true if data is stale.
   */
  const selectStale = createSelector(selectSlice, (slice) => slice.stale);

  /**
   * Selector which returns true if data is being loaded.
   */
  const selectLoading = createSelector(selectSlice, (slice) => slice.loading);

  /**
   * Selector which returns either initialData or loaded data based on status.
   */
  const selectData = createSelector(
    selectSlice,
    selectStale,
    selectLoading,
    (slice, stale, loading) => {
      if (stale && options.resetOnStale) {
        return initialData;
      }
      if (loading && options.resetOnLoading) {
        return initialData;
      }
      return slice.data;
    }
  );

  let previousParams: any | null = null;

  /**
   * Thunk action that conditionally dispatches actions to load data if it's stale and not loading, or if the loader params have changed.
   * @returns Action
   */
  const load =
    () =>
    async (dispatch: Dispatch, getState: () => IRootState): Promise<void> => {
      const state = getState();
      const loading = selectLoading(state);
      const stale = selectStale(state);
      const params = loaderParamsSelector ? loaderParamsSelector(state) : null;

      if ((stale && !loading) || !deepEqual(previousParams, params)) {
        previousParams = params;
        dispatch(slice.actions.makeLoading(null));
        const data = await loader(params);
        // Don't store the data if the params changed in the middle of loading
        if (deepEqual(previousParams, params)) {
          dispatch(slice.actions.fulfill({ data }));
        }
      }
    };

  /**
   * Hook to monitor a slice, which is required to actually load data for the slice.
   * @returns data, loading flag, and makeStale function
   */
  const useMonitoredData = (): IUseMonitoredData<IDataType> => {
    const dispatch = useDispatch();

    const stale = useSelector(selectStale);
    const loading = useSelector(selectLoading);
    const data = useSelector(selectData);
    const params = useSelector(loaderParamsSelector ?? selectNull);

    useEffect(() => {
      if ((stale && !loading) || !deepEqual(previousParams, params)) {
        dispatch(load());
      }
    }, [stale, loading, params, dispatch]);

    const makeStale = useCallback(() => {
      dispatch(slice.actions.makeStale(null));
    }, [dispatch]);

    return {
      data,
      loading: stale || loading,
      makeStale,
    };
  };

  return {
    slice,
    selectors: { selectSlice, selectStale, selectLoading, selectData },
    hooks: { useMonitoredData },
  };
}
