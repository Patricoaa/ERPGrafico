"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

interface UseInitializeFormOptions<TData, TForm extends FieldValues> {
  form: UseFormReturn<TForm>
  data: TData | undefined
  mapData?: (data: TData) => Partial<TForm>
}

/**
 * Initializes a form from server data.
 *
 * `form.reset()` mutates react-hook-form's store, which mounted `Controller`
 * components subscribe to. Running it in a layout effect (instead of during
 * render) avoids React 19's cross-component update warning while still
 * applying the values before paint.
 */
export function useInitializeForm<TData, TForm extends FieldValues>({
  form,
  data,
  mapData,
}: UseInitializeFormOptions<TData, TForm>): void {
  const initializedRef = useRef(false)

  useIsomorphicLayoutEffect(() => {
    if (!data || initializedRef.current) {
      return
    }

    initializedRef.current = true
    const values = mapData ? (mapData(data) as TForm) : (data as unknown as TForm)
    form.reset(values)
    // Initialize once, when the first non-empty server payload arrives.
  }, [data])
}
