import { expect, test } from '@playwright/test'

test('revealed experience opens a memory', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /thirty years/i })).toBeVisible()
  await page.locator('#memories').scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: /step into her world/i }).click()
  await expect(page.getByText(/her world · 6 moments/i).first()).toBeVisible()
  // The rail lists every moment in the current scope, so at world level the
  // first moment can be opened straight away.
  const rail = page.getByLabel('Places and moments')
  await rail
    .getByRole('button', { name: /the rooftop where/i })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toContainText('The rooftop where')
  await expect(page.getByRole('dialog')).toContainText('1 of 6')
  // Next walks through all moments across the whole atlas.
  await page.getByRole('button', { name: /next moment/i }).click()
  await expect(page.getByRole('dialog')).toContainText('2 of 6')
  await expect(page.getByRole('dialog')).toContainText('birthday cake rescue')
  await expect(
    page.getByRole('button', { name: /continue the journey/i }),
  ).toBeVisible()
  await page.getByRole('button', { name: /close moment/i }).click()
  // Closing the story leaves the map where the last moment happened.
  await expect(page.getByText(/bangalore · 2 moments/i).first()).toBeVisible()
  await page.getByRole('button', { name: /back to india/i }).click()
  await expect(page.getByText(/india · 3 moments/i).first()).toBeVisible()
  // Let the camera flight land before zooming manually.
  await page.waitForTimeout(2000)
  // Zooming out manually should climb back up to the world view.
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await expect(page.getByText(/her world · 6 moments/i).first()).toBeVisible()
})

test('gallery view lists every moment and opens stories', async ({ page }) => {
  await page.goto('/')
  await page.locator('#memories').scrollIntoViewIfNeeded()
  await page
    .getByRole('button', { name: /browse every moment as a gallery/i })
    .click()
  await expect(page.getByRole('heading', { name: 'India' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'United States' }),
  ).toBeVisible()
  await page.getByRole('button', { name: /a new york minute/i }).click()
  await expect(page.getByRole('dialog')).toContainText('A New York minute')
  await page.getByRole('button', { name: /close moment/i }).click()
  // Switching to the map continues from the same place.
  await page.getByRole('button', { name: /switch to map view/i }).click()
  await expect(page.getByText(/new york · 1 moment/i).first()).toBeVisible()
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
