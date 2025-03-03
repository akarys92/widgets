import { t, Trans } from '@lingui/macro'
import { Currency } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { useCurrencyBalances } from 'hooks/useCurrencyBalance'
import useNativeCurrency from 'hooks/useNativeCurrency'
import useTokenList, { useIsTokenListLoaded, useQueryTokens } from 'hooks/useTokenList'
import { useAtomValue } from 'jotai/utils'
import { ElementRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Field, onTokenSelectorClickAtom } from 'state/swap'
import styled from 'styled-components/macro'
import { ThemedText } from 'theme'

import Column from '../Column'
import Dialog, { Header } from '../Dialog'
import { inputCss, StringInput } from '../Input'
import Row from '../Row'
import Rule from '../Rule'
import NoTokensAvailableOnNetwork from './NoTokensAvailableOnNetwork'
import TokenButton from './TokenButton'
import TokenOptions from './TokenOptions'
import TokenOptionsSkeleton from './TokenOptionsSkeleton'

const SearchInput = styled(StringInput)`
  ${inputCss}
`

function usePrefetchBalances() {
  const { account } = useWeb3React()
  const tokenList = useTokenList()
  const prefetchedTokenList = useRef<typeof tokenList>()
  useCurrencyBalances(account, tokenList !== prefetchedTokenList.current ? tokenList : undefined)
  prefetchedTokenList.current = tokenList
}

function useAreBalancesLoaded(): boolean {
  const { account } = useWeb3React()
  const tokens = useTokenList()
  const native = useNativeCurrency()
  const currencies = useMemo(() => [native, ...tokens], [native, tokens])
  const balances = useCurrencyBalances(account, currencies).filter(Boolean)
  return !account || currencies.length === balances.length
}

interface TokenSelectDialogProps {
  value?: Currency
  onSelect: (token: Currency) => void
  onClose: () => void
}

export function TokenSelectDialog({ value, onSelect, onClose }: TokenSelectDialogProps) {
  const [query, setQuery] = useState('')
  const list = useTokenList()
  const tokens = useQueryTokens(query, list)

  const isTokenListLoaded = useIsTokenListLoaded()
  const areBalancesLoaded = useAreBalancesLoaded()
  const [isLoaded, setIsLoaded] = useState(isTokenListLoaded && areBalancesLoaded)
  // Give the balance-less tokens a small block period to avoid layout thrashing from re-sorting.
  useEffect(() => {
    if (!isLoaded) {
      const timeout = setTimeout(() => setIsLoaded(true), 250)
      return () => clearTimeout(timeout)
    }
    return
  }, [isLoaded])
  useEffect(
    () => setIsLoaded(Boolean(query) || (isTokenListLoaded && areBalancesLoaded)),
    [query, areBalancesLoaded, isTokenListLoaded]
  )

  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus({ preventScroll: true }), [input])

  const [options, setOptions] = useState<ElementRef<typeof TokenOptions> | null>(null)
  const { chainId } = useWeb3React()
  const listHasTokens = useMemo(() => list.some((token) => token.chainId === chainId), [chainId, list])

  if (!listHasTokens && isLoaded) {
    return (
      <Dialog color="module" onClose={onClose}>
        <Header title={<Trans>Select a token</Trans>} />
        <NoTokensAvailableOnNetwork />
      </Dialog>
    )
  }
  return (
    <Dialog color="module" onClose={onClose}>
      <Header title={<Trans>Select a token</Trans>} />
      <Column gap={0.75}>
        <Row pad={0.75} grow>
          <ThemedText.Body1>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={t`Search by token name or address`}
              onKeyDown={options?.onKeyDown}
              onBlur={options?.blur}
              ref={input}
            />
          </ThemedText.Body1>
        </Row>
        <Rule padded />
      </Column>
      {isLoaded ? (
        tokens.length ? (
          <TokenOptions tokens={tokens} onSelect={onSelect} ref={setOptions} />
        ) : (
          <Column padded>
            <Row justify="center">
              <ThemedText.Body1 color="secondary">
                <Trans>No results found.</Trans>
              </ThemedText.Body1>
            </Row>
          </Column>
        )
      ) : (
        <TokenOptionsSkeleton />
      )}
    </Dialog>
  )
}

interface TokenSelectProps {
  collapsed: boolean
  disabled?: boolean
  field: Field
  onSelect: (value: Currency) => void
  value?: Currency
}

export default memo(function TokenSelect({ collapsed, disabled, field, onSelect, value }: TokenSelectProps) {
  usePrefetchBalances()

  const [open, setOpen] = useState(false)
  const onTokenSelectorClick = useAtomValue(onTokenSelectorClickAtom)
  const onOpen = useCallback(() => {
    const promise = onTokenSelectorClick?.(field)
    if (promise) {
      return promise
        .then((open) => {
          setOpen(open)
        })
        .catch(() => {
          setOpen(false)
        })
    }
    return setOpen(true)
  }, [field, onTokenSelectorClick])
  const selectAndClose = useCallback(
    (value: Currency) => {
      onSelect(value)
      setOpen(false)
    },
    [onSelect, setOpen]
  )
  return (
    <>
      <TokenButton value={value} collapsed={collapsed} disabled={disabled} onClick={onOpen} />
      {open && <TokenSelectDialog value={value} onSelect={selectAndClose} onClose={() => setOpen(false)} />}
    </>
  )
})
