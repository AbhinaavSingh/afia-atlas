import { expect, test } from '@playwright/test'

test('revealed experience opens a memory', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /thirty years/i })).toBeVisible()
  await page.locator('#memories').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: /step into her world/i }).click()
  await expect(page.getByText(/her world · 6 moments/i).first()).toBeVisible()
  const rail = page.getByLabel('Places and memories')
  await rail.getByRole('button', { name: /india.*3 moments/i }).click()
  await rail.getByRole('button', { name: /bangalore.*2 moments/i }).click()
  await rail
    .getByRole('button', { name: /the rooftop where/i })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toContainText('The rooftop where')
  await expect(
    page.getByRole('button', { name: /continue the journey/i }),
  ).toBeVisible()
})

test('contribution page exposes the complete story flow', async ({ page }) => {
  await page.goto('/contribute')
  await expect(
    page.getByRole('heading', { name: /place one moment/i }),
  ).toBeVisible()
  await expect(page.getByLabel(/what was happening here/i)).toBeVisible()
  await expect(page.getByText(/choose your photograph/i).first()).toBeVisible()
})

test('admin preview has moderation and reveal controls', async ({ page }) => {
  await page.goto('/admin')
  await expect(
    page.getByRole('heading', { name: /atlas entries/i }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /experience is live/i })).toBeVisible()
})
