import { test, expect } from '@playwright/test';

test.describe('Position Rebalancing', () => {
  test('50+ drags within column maintain valid positions', async ({ page }) => {
    await page.goto('/');

    // Create board and column
    const boardName = `Rebalance Board ${Date.now()}`;
    await page.getByPlaceholder('New board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();
    await page.getByRole('link', { name: boardName }).click();
    await expect(page.getByRole('heading', { name: boardName, level: 1 })).toBeVisible();

    await page.getByPlaceholder('New column name').fill('Stress Column');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'Stress Column' })).toBeVisible();

    const column = page.locator('div.w-72').filter({ hasText: 'Stress Column' });

    // Create 5 cards
    for (let i = 1; i <= 5; i++) {
      await column.getByPlaceholder('Add a card...').fill(`Card ${i}`);
      await column.getByRole('button', { name: 'Add Card' }).click();
      await expect(column.locator('.font-medium').filter({ hasText: `Card ${i}` })).toBeVisible();
    }

    // Perform 50 drag-and-drop operations alternating between dragging last to first and first to last
    for (let i = 0; i < 50; i++) {
      const cards = column.locator('[data-card-id]');
      const count = await cards.count();
      if (count < 2) break;

      if (i % 2 === 0) {
        // Drag last card to first card position
        const lastCard = cards.nth(count - 1);
        const firstCard = cards.nth(0);
        await lastCard.dragTo(firstCard);
      } else {
        // Drag first card to last card position
        const firstCard = cards.nth(0);
        const lastCard = cards.nth(count - 1);
        await firstCard.dragTo(lastCard);
      }

      await page.waitForLoadState('networkidle');
    }

    // Verify all 5 cards still exist
    const finalCards = column.locator('[data-card-id]');
    await expect(finalCards).toHaveCount(5);

    // Verify positions are still usable by doing one more drag
    const firstCard = finalCards.nth(0);
    const secondCard = finalCards.nth(1);
    const firstCardText = await firstCard.locator('.font-medium').textContent();

    await firstCard.dragTo(secondCard);
    await page.waitForLoadState('networkidle');

    // Verify the drag succeeded (card moved)
    const newSecondCard = finalCards.nth(1);
    const newSecondCardText = await newSecondCard.locator('.font-medium').textContent();
    expect(newSecondCardText).toBe(firstCardText);
  });

  test('cross-column drags maintain valid positions', async ({ page }) => {
    await page.goto('/');

    // Create board with two columns
    const boardName = `Cross Rebalance ${Date.now()}`;
    await page.getByPlaceholder('New board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();
    await page.getByRole('link', { name: boardName }).click();
    await expect(page.getByRole('heading', { name: boardName, level: 1 })).toBeVisible();

    // Create two columns
    await page.getByPlaceholder('New column name').fill('Col A');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'Col A' })).toBeVisible();

    await page.getByPlaceholder('New column name').fill('Col B');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'Col B' })).toBeVisible();

    const colA = page.locator('div.w-72').filter({ hasText: 'Col A' });
    const colB = page.locator('div.w-72').filter({ hasText: 'Col B' });

    // Create 3 cards in Col A
    for (let i = 1; i <= 3; i++) {
      await colA.getByPlaceholder('Add a card...').fill(`Card ${i}`);
      await colA.getByRole('button', { name: 'Add Card' }).click();
      await expect(colA.locator('.font-medium').filter({ hasText: `Card ${i}` })).toBeVisible();
    }

    // Move cards back and forth between columns 20 times
    for (let i = 0; i < 20; i++) {
      if (i % 2 === 0) {
        // Move first card from Col A to Col B
        const cards = colA.locator('[data-card-id]');
        const count = await cards.count();
        if (count === 0) continue;
        const card = cards.nth(0);
        const dropTarget = colB.locator('.min-h-\\[50px\\]');
        await card.dragTo(dropTarget);
      } else {
        // Move first card from Col B to Col A
        const cards = colB.locator('[data-card-id]');
        const count = await cards.count();
        if (count === 0) continue;
        const card = cards.nth(0);
        const dropTarget = colA.locator('.min-h-\\[50px\\]');
        await card.dragTo(dropTarget);
      }
      await page.waitForLoadState('networkidle');
      // Wait for total card count to stabilize at 3
      await expect(async () => {
        const a = await colA.locator('[data-card-id]').count();
        const b = await colB.locator('[data-card-id]').count();
        expect(a + b).toBe(3);
      }).toPass({ timeout: 5000 });
    }

    // Verify total card count across both columns is still 3
    const colACards = await colA.locator('[data-card-id]').count();
    const colBCards = await colB.locator('[data-card-id]').count();
    expect(colACards + colBCards).toBe(3);
  });
});
