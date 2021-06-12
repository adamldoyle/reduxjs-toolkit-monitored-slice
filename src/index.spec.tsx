import { Provider } from 'react-redux';
import {
  PayloadAction,
  configureStore,
  createSlice,
  SliceCaseReducers,
  createSelector,
} from '@reduxjs/toolkit';
import { waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import { createMonitoredSlice, IMonitoredState } from './';

interface ITestItem {
  id: string;
  name: string;
}

interface ITestState extends IMonitoredState<ITestItem[]> {
  selected: string | null;
}

interface IOtherState {
  param1: string | null;
  param2: string | null;
}

interface IRootState {
  testSlice: ITestState;
  otherSlice: IOtherState;
}

const DEFAULT_INITIAL_DATA = [{ id: 'initialId', name: 'initialName' }];
const DEFAULT_INITIAL_STATE = { selected: null };
const DEFAULT_LOADER = jest.fn().mockResolvedValue([]);

const otherSlice = createSlice<IOtherState, SliceCaseReducers<IOtherState>>({
  name: 'otherSlice',
  initialState: {
    param1: 'value1',
    param2: 'value2',
  },
  reducers: {
    setParams: (state, action: PayloadAction<IOtherState>) => {
      state.param1 = action.payload.param1;
      state.param2 = action.payload.param2;
    },
  },
});

const selectParams = createSelector<
  IRootState,
  IOtherState,
  [string | null, string | null]
>(
  (state) => state.otherSlice,
  (slice) => [slice.param1, slice.param2]
);

const buildTestSlice = (
  options: { resetOnStale?: boolean; resetOnLoading?: boolean } = {},
  initialData: ITestItem[] = DEFAULT_INITIAL_DATA,
  initialState = DEFAULT_INITIAL_STATE,
  loader = DEFAULT_LOADER,
  loaderParamsSelector = undefined
) => {
  return createMonitoredSlice<IRootState, ITestItem[], ITestState, null>(
    {
      name: 'testSlice',
      initialState: initialState,
      reducers: {
        select: (state, action: PayloadAction<string>) => {
          state.selected = action.payload;
        },
      },
      ...options,
    },
    initialData,
    loader,
    loaderParamsSelector
  );
};

const buildRootState = (
  modifications: {
    stale?: boolean;
    loading?: boolean;
    data?: ITestItem[];
    selected?: string;
  } = {}
) => ({
  testSlice: {
    stale: true,
    loading: false,
    data: [
      { id: 'id1', name: 'name1' },
      { id: 'id2', name: 'name2' },
    ],
    selected: 'id2',
    ...modifications,
  },
  otherSlice: {
    param1: null,
    param2: null,
  },
});

describe('createMonitoredSlice', () => {
  describe('selectors', () => {
    describe('selectSlice', () => {
      it('returns the entire slice object', () => {
        const { selectors } = buildTestSlice();
        const rootState = buildRootState();
        const sliceData = selectors.selectSlice(rootState);
        expect(sliceData).toEqual(rootState.testSlice);
      });
    });

    describe('selectStale', () => {
      it('returns if the slice is stale', () => {
        const { selectors } = buildTestSlice();
        const rootState = buildRootState();
        const stale = selectors.selectStale(rootState);
        expect(stale).toEqual(rootState.testSlice.stale);
      });
    });

    describe('selectLoading', () => {
      it('returns if the slice is loading', () => {
        const { selectors } = buildTestSlice();
        const rootState = buildRootState();
        const loading = selectors.selectLoading(rootState);
        expect(loading).toEqual(rootState.testSlice.loading);
      });
    });

    describe('selectData', () => {
      it('returns the data from the slice', () => {
        const { selectors } = buildTestSlice({
          resetOnLoading: false,
          resetOnStale: false,
        });
        const rootState = buildRootState({ stale: false, loading: false });
        const data = selectors.selectData(rootState);
        expect(data).toEqual(rootState.testSlice.data);
      });

      it('returns the data from the slice if stale and not set to resetOnStale', () => {
        const { selectors } = buildTestSlice({
          resetOnLoading: false,
          resetOnStale: false,
        });
        const rootState = buildRootState({ stale: true, loading: false });
        const data = selectors.selectData(rootState);
        expect(data).toEqual(rootState.testSlice.data);
      });

      it('returns the initial data if stale and set to resetOnStale', () => {
        const { selectors } = buildTestSlice({
          resetOnLoading: false,
          resetOnStale: true,
        });
        const rootState = buildRootState({ stale: true, loading: false });
        const data = selectors.selectData(rootState);
        expect(data).toEqual(DEFAULT_INITIAL_DATA);
      });

      it('returns the data from the slice if loading and not set to resetOnLoading', () => {
        const { selectors } = buildTestSlice({
          resetOnLoading: false,
          resetOnStale: false,
        });
        const rootState = buildRootState({ stale: false, loading: true });
        const data = selectors.selectData(rootState);
        expect(data).toEqual(rootState.testSlice.data);
      });

      it('returns the initial data if loading and set to resetOnLoading', () => {
        const { selectors } = buildTestSlice({
          resetOnLoading: true,
          resetOnStale: false,
        });
        const rootState = buildRootState({ stale: false, loading: true });
        const data = selectors.selectData(rootState);
        expect(data).toEqual(DEFAULT_INITIAL_DATA);
      });
    });
  });

  describe('slice', () => {
    it('is named appropriately', () => {
      const { slice } = buildTestSlice();
      expect(slice.name).toEqual('testSlice');
    });

    describe('reducer', () => {
      describe('makeStale', () => {
        it('sets the slice to stale', () => {
          const { slice } = buildTestSlice({ resetOnStale: false });
          const rootState = buildRootState({ stale: false });
          const testState = rootState.testSlice;
          expect(
            slice.reducer(testState, { type: 'testSlice/makeStale' })
          ).toEqual({ ...testState, stale: true });
        });

        it('sets the data to initial data if resetOnStale is true', () => {
          const { slice } = buildTestSlice({ resetOnStale: true });
          const rootState = buildRootState({ stale: false });
          const testState = rootState.testSlice;
          expect(
            slice.reducer(testState, { type: 'testSlice/makeStale' })
          ).toEqual({ ...testState, stale: true, data: DEFAULT_INITIAL_DATA });
        });
      });

      describe('makeLoading', () => {
        it('sets the slice to loading', () => {
          const { slice } = buildTestSlice();
          const rootState = buildRootState({ loading: false });
          const testState = rootState.testSlice;
          expect(
            slice.reducer(testState, { type: 'testSlice/makeLoading' })
          ).toEqual({ ...testState, loading: true });
        });

        it('does not impact data even with resetOnLoading true', () => {
          const { slice } = buildTestSlice({ resetOnLoading: true });
          const rootState = buildRootState({ loading: false });
          const testState = rootState.testSlice;
          expect(
            slice.reducer(testState, { type: 'testSlice/makeLoading' })
          ).toEqual({ ...testState, loading: true });
        });
      });

      describe('fulfill', () => {
        it('sets data and resets stale and loading to false', () => {
          const { slice } = buildTestSlice();
          const rootState = buildRootState({ loading: true, stale: true });
          const testState = rootState.testSlice;
          expect(
            slice.reducer(testState, {
              type: 'testSlice/fulfill',
              payload: { data: ['test'] },
            })
          ).toEqual({
            ...testState,
            stale: false,
            loading: false,
            data: ['test'],
          });
        });
      });

      it('supports other reducers', () => {
        const { slice } = buildTestSlice();
        const rootState = buildRootState({ loading: true, stale: true });
        const testState = rootState.testSlice;
        expect(
          slice.reducer(testState, {
            type: 'testSlice/select',
            payload: 'newId',
          })
        ).toEqual({ ...testState, selected: 'newId' });
      });
    });

    it('initializes state as stale and not loading with initial data', () => {
      const { slice } = buildTestSlice(undefined, undefined, {
        selected: 'initial',
      });
      const store = configureStore({
        reducer: {
          testSlice: slice.reducer,
        },
      });
      expect(store.getState()).toEqual({
        testSlice: {
          selected: 'initial',
          stale: true,
          loading: false,
          data: DEFAULT_INITIAL_DATA,
        },
      });
    });
  });

  describe('hooks', () => {
    describe('useMonitoredData', () => {
      let renderedStore;
      const renderMonitoredHook = (
        loader = DEFAULT_LOADER,
        loaderParamsSelector = null
      ) => {
        const { slice, hooks } = buildTestSlice(
          undefined,
          undefined,
          undefined,
          loader,
          loaderParamsSelector
        );
        renderedStore = configureStore({
          reducer: {
            testSlice: slice.reducer,
            otherSlice: otherSlice.reducer,
          },
        });
        const rendered = renderHook(() => hooks.useMonitoredData(), {
          wrapper: ({ children }) => (
            <Provider store={renderedStore}>{children}</Provider>
          ),
        });
        return rendered;
      };

      it('sets loading and returns initial data', () => {
        const rendered = renderMonitoredHook();
        const results = rendered.result.current;
        expect(results.loading).toBeTruthy();
        expect(results.data).toEqual(DEFAULT_INITIAL_DATA);
      });

      it('loads and returns new data', async () => {
        const loadedData = [
          { id: 'id1', name: 'name1' },
          { id: 'id2', name: 'name2' },
        ];
        const loader = jest.fn().mockResolvedValue(loadedData);
        const rendered = renderMonitoredHook(loader);
        await waitFor(() =>
          expect(rendered.result.current.loading).toBeFalsy()
        );
        expect(rendered.result.current.data).toEqual(loadedData);
      });

      it('supports marking data as stale to reload', async () => {
        const loader = jest.fn().mockResolvedValue([]);
        const rendered = renderMonitoredHook(loader);
        await waitFor(() =>
          expect(rendered.result.current.loading).toBeFalsy()
        );
        const loadedData = [
          { id: 'id1', name: 'name1' },
          { id: 'id2', name: 'name2' },
        ];
        loader.mockResolvedValue(loadedData);
        rendered.result.current.makeStale();
        await waitFor(() =>
          expect(rendered.result.current.data).toEqual(loadedData)
        );
      });

      it('passes null for params if no loader params selector configured', async () => {
        const loader = jest.fn().mockResolvedValue([]);
        const rendered = renderMonitoredHook(loader);
        await waitFor(() =>
          expect(rendered.result.current.loading).toBeFalsy()
        );
        expect(loader).toBeCalledWith(null);
      });

      it('passes params if loader params selector configured', async () => {
        const loader = jest.fn().mockResolvedValue([]);
        const rendered = renderMonitoredHook(loader, selectParams);
        await waitFor(() =>
          expect(rendered.result.current.loading).toBeFalsy()
        );
        expect(loader).toBeCalledWith(['value1', 'value2']);
      });

      it('automatically reloads data if params change', async () => {
        const loader = jest.fn().mockImplementation((params) => {
          return Promise.resolve([{ id: params[0], name: params[1] }]);
        });
        const rendered = renderMonitoredHook(loader, selectParams);
        await waitFor(() =>
          expect(rendered.result.current.data).toEqual([
            { id: 'value1', name: 'value2' },
          ])
        );
        expect(loader).toBeCalledWith(['value1', 'value2']);
        jest.clearAllMocks();
        renderedStore.dispatch(
          otherSlice.actions.setParams({ param1: 'value3', param2: 'value4' })
        );
        await waitFor(() =>
          expect(rendered.result.current.data).toEqual([
            { id: 'value3', name: 'value4' },
          ])
        );
        expect(loader).toBeCalledWith(['value3', 'value4']);
      });

      it('only stores loaded data if params still match', async () => {
        const loader = jest.fn().mockImplementation((params) => {
          if (params[0] === 'value1') {
            // Dispatch new params in middle of loader for old params
            renderedStore.dispatch(
              otherSlice.actions.setParams({
                param1: 'value3',
                param2: 'value4',
              })
            );
          }
          return Promise.resolve([{ id: params[0], name: params[1] }]);
        });
        const rendered = renderMonitoredHook(loader, selectParams);
        renderedStore.subscribe(() => {
          expect(renderedStore.getState().testSlice.data).not.toEqual([
            { id: 'value1', name: 'value2' },
          ]);
        });
        await waitFor(() =>
          expect(rendered.result.current.data).toEqual([
            { id: 'value3', name: 'value4' },
          ])
        );
      });
    });
  });
});
