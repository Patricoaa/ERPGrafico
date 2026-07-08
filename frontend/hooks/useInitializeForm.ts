"use client"

import { useState } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"

interface UseInitializeFormOptions<TData, TForm extends FieldValues> {
  form: UseFormReturn<TForm>
  data: TData | undefined
  mapData?: (data: TData) => Partial<TForm>
}

export function useInitializeForm<TData, TForm extends FieldValues>({
  form,
  data,
  mapData,
}: UseInitializeFormOptions<TData, TForm>): void {
  const [initialized, setInitialized] = useState(false)

  // "Adjust state during render" pattern (ADR-0051)
  // form.reset() during render is safe for react-hook-form — it updates the
  // internal store without scheduling a React re-render. No useEffect needed.
  // setInitialized during render is batched — no cascading cycle.
  if (data && !initialized) {
    setInitialized(true)
    const values = mapData ? (mapData(data) as TForm) : (data as unknown as TForm)
    form.reset(values)
  }
}
