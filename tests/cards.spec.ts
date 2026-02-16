import { test, expect } from '@playwright/test';

test.describe('Card CRUD and Drag-and-Drop', () => {
  test.beforeEach(async ({ page }) => {
    // Create a fresh board with two columns
    await page.goto('/');
    const boardName = `Card Test Board ${Date.now()}`;
    await page.getByPlaceholder('New board name').fill(boardName);
    await page.getByRole('button', { name: 'Create Board' }).click();
    await page.getByRole('link', { name: boardName }).click();
    await expect(page.getByRole('heading', { name: boardName, level: 1 })).toBeVisible();

    // Create two columns
    await page.getByPlaceholder('New column name').fill('Column A');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'Column A' })).toBeVisible();

    await page.getByPlaceholder('New column name').fill('Column B');
    await page.getByRole('button', { name: 'Add Column' }).click();
    await expect(page.locator('h3').filter({ hasText: 'Column B' })).toBeVisible();
  });

  test('create a card in a column', async ({ page }) => {
    const cardTitle = `Card ${Date.now()}`;
    const columnA = page.locator('div.w-72').filter({ hasText: 'Column A' });

    await columnA.getByPlaceholder('Add a card...').fill(cardTitle);
    await columnA.getByRole('button', { name: 'Add Card' }).click();

    // Card title should appear in the column
    await expect(columnA.locator('text=' + cardTitle)).toBeVisible();
  });

  test('edit card title, description, and color', async ({ page }) => {
    const columnA = page.locator('div.w-72').filter({ hasText: 'Column A' });

    // Create a card
    const cardTitle = `Edit Card ${Date.now()}`;
    await columnA.getByPlaceholder('Add a card...').fill(cardTitle);
    await columnA.getByRole('button', { name: 'Add Card' }).click();
    await expect(columnA.locator('text=' + cardTitle)).toBeVisible();

    // Click on card title to enter edit mode
    await columnA.locator('div.bg-white').filter({ hasText: cardTitle }).locator('.font-medium').click();

    // Fill in updated fields — target the card in edit mode (only one card exists)
    const newTitle = `Updated Card ${Date.now()}`;
    const editingCard = columnA.locator('div.bg-white');
    const editInput = editingCard.locator('input[type="text"]');
    await editInput.fill(newTitle);

    const descTextarea = editingCard.locator('textarea');
    await descTextarea.fill('A test description');

    const colorSelect = editingCard.locator('select');
    await colorSelect.selectOption('blue');

    // Click Save
    await editingCard.getByRole('button', { name: 'Save' }).click();

    // Verify updated title
    await expect(columnA.locator('.font-medium').filter({ hasText: newTitle })).toBeVisible();
    // Verify description appears
    await expect(columnA.locator('text=A test description')).toBeVisible();
    // Verify color badge
    await expect(columnA.locator('span').filter({ hasText: 'blue' })).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await expect(columnA.locator('.font-medium').filter({ hasText: newTitle })).toBeVisible();
    await expect(columnA.locator('text=A test description')).toBeVisible();
    await expect(columnA.locator('span').filter({ hasText: 'blue' })).toBeVisible();
  });

  test('archive a card', async ({ page }) => {
    const columnA = page.locator('div.w-72').filter({ hasText: 'Column A' });

    // Create a card
    const cardTitle = `Archive Card ${Date.now()}`;
    await columnA.getByPlaceholder('Add a card...').fill(cardTitle);
    await columnA.getByRole('button', { name: 'Add Card' }).click();
    await expect(columnA.locator('text=' + cardTitle)).toBeVisible();

    // Click Archive on the card
    const cardDiv = columnA.locator('div.bg-white').filter({ hasText: cardTitle });
    await cardDiv.getByRole('button', { name: 'Archive' }).click();

    // Verify card is removed from view
    await expect(columnA.locator('text=' + cardTitle)).not.toBeVisible();
  });

  test('drag card within column to reorder', async ({ page }) => {
    const columnA = page.locator('div.w-72').filter({ hasText: 'Column A' });

    // Create two cards
    await columnA.getByPlaceholder('Add a card...').fill('Card One');
    await columnA.getByRole('button', { name: 'Add Card' }).click();
    await expect(columnA.locator('.font-medium').filter({ hasText: 'Card One' })).toBeVisible();

    await columnA.getByPlaceholder('Add a card...').fill('Card Two');
    await columnA.getByRole('button', { name: 'Add Card' }).click();
    await expect(columnA.locator('.font-medium').filter({ hasText: 'Card Two' })).toBeVisible();

    // Verify initial order
    const cards = columnA.locator('div.bg-white');
    await expect(cards.nth(0)).toContainText('Card One');
    await expect(cards.nth(1)).toContainText('Card Two');

    // Drag Card Two onto Card One
    const source = columnA.locator('div.bg-white').filter({ hasText: 'Card Two' });
    const target = columnA.locator('div.bg-white').filter({ hasText: 'Card One' });
    await source.dragTo(target);

    // Wait for network idle (PATCH /api/cards/:id/position completes)
    await page.waitForLoadState('networkidle');

    // Verify new order
    await expect(cards.nth(0)).toContainText('Card Two');
    await expect(cards.nth(1)).toContainText('Card One');

    // Reload and verify persistence
    await page.reload();
    const reloadedColumnA = page.locator('div.w-72').filter({ hasText: 'Column A' });
    const reloadedCards = reloadedColumnA.locator('div.bg-white');
    await expect(reloadedCards.nth(0)).toContainText('Card Two');
    await expect(reloadedCards.nth(1)).toContainText('Card One');
  });

  test('drag card between columns', async ({ page }) => {
    const columnA = page.locator('div.w-72').filter({ hasText: 'Column A' });
    const columnB = page.locator('div.w-72').filter({ hasText: 'Column B' });

    // Create a card in Column A
    await columnA.getByPlaceholder('Add a card...').fill('Moving Card');
    await columnA.getByRole('button', { name: 'Add Card' }).click();
    await expect(columnA.locator('.font-medium').filter({ hasText: 'Moving Card' })).toBeVisible();

    // Drag the card to Column B's drop area (use min-h to avoid matching the form's space-y-2)
    const cardElement = columnA.locator('div.bg-white').filter({ hasText: 'Moving Card' });
    const dropTarget = columnB.locator('.min-h-\\[50px\\]');
    await cardElement.dragTo(dropTarget);

    // Wait for network idle (PATCH /api/cards/:id/column completes)
    await page.waitForLoadState('networkidle');

    // Verify card moved to Column B
    await expect(columnB.locator('text=Moving Card')).toBeVisible();

    // Reload and verify persistence
    await page.reload();
    const reloadedColumnB = page.locator('div.w-72').filter({ hasText: 'Column B' });
    await expect(reloadedColumnB.locator('text=Moving Card')).toBeVisible();
  });

  test('delete a column cascades to its cards', async ({ page }) => {
    const columnA = page.locator('div.w-72').filter({ hasText: 'Column A' });

    // Create a card in Column A
    await columnA.getByPlaceholder('Add a card...').fill('Cascade Card');
    await columnA.getByRole('button', { name: 'Add Card' }).click();
    await expect(columnA.locator('text=Cascade Card')).toBeVisible();

    // Set up dialog handler
    page.on('dialog', (dialog) => dialog.accept());

    // Delete Column A (target the column-level delete button, not the card's archive)
    await columnA.locator('button.text-sm').filter({ hasText: 'Delete' }).click();

    // Verify column and its card are gone
    await expect(page.locator('h3').filter({ hasText: 'Column A' })).not.toBeVisible();
    await expect(page.locator('text=Cascade Card')).not.toBeVisible();
  });

  test('create multiple cards and verify order', async ({ page }) => {
    const columnA = page.locator('div.w-72').filter({ hasText: 'Column A' });

    // Create three cards
    for (const title of ['Alpha', 'Beta', 'Gamma']) {
      await columnA.getByPlaceholder('Add a card...').fill(title);
      await columnA.getByRole('button', { name: 'Add Card' }).click();
      await expect(columnA.locator('.font-medium').filter({ hasText: title })).toBeVisible();
    }

    // Verify order
    const cards = columnA.locator('div.bg-white');
    await expect(cards.nth(0)).toContainText('Alpha');
    await expect(cards.nth(1)).toContainText('Beta');
    await expect(cards.nth(2)).toContainText('Gamma');

    // Reload and verify persistence
    await page.reload();
    const reloadedColumnA = page.locator('div.w-72').filter({ hasText: 'Column A' });
    const reloadedCards = reloadedColumnA.locator('div.bg-white');
    await expect(reloadedCards.nth(0)).toContainText('Alpha');
    await expect(reloadedCards.nth(1)).toContainText('Beta');
    await expect(reloadedCards.nth(2)).toContainText('Gamma');
  });
});
