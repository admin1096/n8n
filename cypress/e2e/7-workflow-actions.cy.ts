import {
	CODE_NODE_NAME,
	MANUAL_TRIGGER_NODE_NAME,
	META_KEY,
	SCHEDULE_TRIGGER_NODE_NAME,
	EDIT_FIELDS_SET_NODE_NAME,
	INSTANCE_MEMBERS,
	INSTANCE_OWNER,
} from '../constants';
import { WorkflowPage as WorkflowPageClass } from '../pages/workflow';
import { WorkflowsPage as WorkflowsPageClass } from '../pages/workflows';
import { getVisibleSelect } from '../utils';
import { WorkflowExecutionsTab } from '../pages';

const NEW_WORKFLOW_NAME = 'Something else';
const IMPORT_WORKFLOW_URL =
	'https://gist.githubusercontent.com/OlegIvaniv/010bd3f45c8a94f8eb7012e663a8b671/raw/3afea1aec15573cc168d9af7e79395bd76082906/test-workflow.json';
const DUPLICATE_WORKFLOW_NAME = 'Duplicated workflow';
const DUPLICATE_WORKFLOW_TAG = 'Duplicate';

const WorkflowPage = new WorkflowPageClass();
const WorkflowPages = new WorkflowsPageClass();
const executionsTab = new WorkflowExecutionsTab();

describe('Workflow Actions', () => {
	beforeEach(() => {
		WorkflowPage.actions.visit();
	});

	it('should be able to save on button click', () => {
		WorkflowPage.actions.saveWorkflowOnButtonClick();
		WorkflowPage.getters.isWorkflowSaved();
	});

	it('should save workflow on keyboard shortcut', () => {
		WorkflowPage.actions.saveWorkflowUsingKeyboardShortcut();
		WorkflowPage.getters.isWorkflowSaved();
	});

	it('should not be able to activate unsaved workflow', () => {
		WorkflowPage.getters.activatorSwitch().find('input').first().should('be.disabled');
	});

	it('should not be able to activate workflow without trigger node', () => {
		// Manual trigger is not enough to activate the workflow
		WorkflowPage.actions.addNodeToCanvas(MANUAL_TRIGGER_NODE_NAME);
		WorkflowPage.actions.saveWorkflowOnButtonClick();
		WorkflowPage.getters.activatorSwitch().find('input').first().should('be.disabled');
	});

	it('should be able to activate workflow', () => {
		WorkflowPage.actions.addNodeToCanvas(SCHEDULE_TRIGGER_NODE_NAME);
		WorkflowPage.actions.saveWorkflowOnButtonClick();
		WorkflowPage.actions.activateWorkflow();
		WorkflowPage.getters.isWorkflowActivated();
	});

	it('should save new workflow after renaming', () => {
		WorkflowPage.actions.renameWorkflow(NEW_WORKFLOW_NAME);
		WorkflowPage.getters.isWorkflowSaved();
	});

	it('should rename workflow', () => {
		WorkflowPage.actions.addNodeToCanvas(SCHEDULE_TRIGGER_NODE_NAME);
		WorkflowPage.actions.saveWorkflowOnButtonClick();
		WorkflowPage.actions.renameWorkflow(NEW_WORKFLOW_NAME);
		WorkflowPage.getters.isWorkflowSaved();
		WorkflowPage.getters
			.workflowNameInputContainer()
			.invoke('attr', 'title')
			.should('eq', NEW_WORKFLOW_NAME);
	});

	it('should not save workflow if canvas is loading', () => {
		let interceptCalledCount = 0;

		// There's no way in Cypress to check if intercept was not called
		// so we'll count the number of times it was called
		cy.intercept('PATCH', '/rest/workflows/*', () => {
			interceptCalledCount++;
		}).as('saveWorkflow');

		WorkflowPage.actions.addNodeToCanvas(MANUAL_TRIGGER_NODE_NAME);
		WorkflowPage.actions.saveWorkflowOnButtonClick();
		cy.intercept(
			{
				url: '/rest/workflows/*',
				method: 'GET',
				middleware: true,
			},
			(req) => {
				// Delay the response to give time for the save to be triggered
				req.on('response', async (res) => {
					await new Promise((resolve) => setTimeout(resolve, 2000));
					res.send();
				});
			},
		);
		cy.reload();
		cy.get('.el-loading-mask').should('exist');
		cy.get('body').type(META_KEY, { release: false }).type('s');
		cy.get('body').type(META_KEY, { release: false }).type('s');
		cy.get('body').type(META_KEY, { release: false }).type('s');
		cy.wrap(null).then(() => expect(interceptCalledCount).to.eq(0));
		cy.waitForLoad();
		WorkflowPage.actions.addNodeToCanvas(SCHEDULE_TRIGGER_NODE_NAME);
		cy.get('body').type(META_KEY, { release: false }).type('s');
		cy.wait('@saveWorkflow');
		cy.wrap(null).then(() => expect(interceptCalledCount).to.eq(1));
	});
	it('should copy nodes', () => {
		WorkflowPage.actions.addNodeToCanvas(SCHEDULE_TRIGGER_NODE_NAME);
		WorkflowPage.actions.addNodeToCanvas(CODE_NODE_NAME);
		WorkflowPage.getters.canvasNodes().should('have.have.length', 2);

		cy.get('#node-creator').should('not.exist');
		cy.get('body').type(META_KEY, { delay: 500, release: false }).type('a');
		cy.get('.jtk-drag-selected').should('have.length', 2);
		cy.get('body').type(META_KEY, { delay: 500, release: false }).type('c');
		WorkflowPage.getters.successToast().should('exist');
	});

	it('should paste nodes', () => {
		cy.fixture('Test_workflow-actions_paste-data.json').then((data) => {
			cy.get('body').paste(JSON.stringify(data));
			WorkflowPage.getters.canvasNodes().should('have.have.length', 2);
		});
	});

	it('should import workflow from url', () => {
		WorkflowPage.getters.workflowMenu().should('be.visible');
		WorkflowPage.getters.workflowMenu().click();
		WorkflowPage.getters.workflowMenuItemImportFromURLItem().should('be.visible');
		WorkflowPage.getters.workflowMenuItemImportFromURLItem().click();
		cy.get('.el-message-box').should('be.visible');
		cy.get('.el-message-box').find('input').type(IMPORT_WORKFLOW_URL);
		cy.get('body').type('{enter}');
		cy.waitForLoad(false);
		WorkflowPage.actions.zoomToFit();
		WorkflowPage.getters.canvasNodes().should('have.length', 2);
		WorkflowPage.getters.nodeConnections().should('have.length', 1);
	});

	it('should import workflow from file', () => {
		WorkflowPage.getters
			.workflowImportInput()
			.selectFile('cypress/fixtures/Test_workflow-actions_paste-data.json', { force: true });
		cy.waitForLoad(false);
		WorkflowPage.actions.zoomToFit();
		WorkflowPage.getters.canvasNodes().should('have.length', 2);
		WorkflowPage.getters.nodeConnections().should('have.length', 1);
	});

	it('should update workflow settings', () => {
		cy.visit(WorkflowPages.url);
		WorkflowPages.getters.workflowCards().then((cards) => {
			const totalWorkflows = cards.length;

			WorkflowPage.actions.visit();
			// Open settings dialog
			WorkflowPage.actions.saveWorkflowOnButtonClick();
			WorkflowPage.getters.workflowMenu().should('be.visible');
			WorkflowPage.getters.workflowMenu().click();
			WorkflowPage.getters.workflowMenuItemSettings().should('be.visible');
			WorkflowPage.getters.workflowMenuItemSettings().click();
			// Change all settings
			// totalWorkflows + 1 (current workflow) + 1 (no workflow option)
			WorkflowPage.getters.workflowSettingsErrorWorkflowSelect().click();
			getVisibleSelect()
				.find('li')
				.should('have.length', totalWorkflows + 2);
			getVisibleSelect().find('li').last().click({ force: true });
			WorkflowPage.getters.workflowSettingsTimezoneSelect().click();
			getVisibleSelect().find('li').should('exist');
			getVisibleSelect().find('li').eq(1).click({ force: true });
			WorkflowPage.getters.workflowSettingsSaveFiledExecutionsSelect().click();
			getVisibleSelect().find('li').should('have.length', 3);
			getVisibleSelect().find('li').last().click({ force: true });
			WorkflowPage.getters.workflowSettingsSaveSuccessExecutionsSelect().click();
			getVisibleSelect().find('li').should('have.length', 3);
			getVisibleSelect().find('li').last().click({ force: true });
			WorkflowPage.getters.workflowSettingsSaveManualExecutionsSelect().click();
			getVisibleSelect().find('li').should('have.length', 3);
			getVisibleSelect().find('li').last().click({ force: true });
			WorkflowPage.getters.workflowSettingsSaveExecutionProgressSelect().click();
			getVisibleSelect().find('li').should('have.length', 3);
			getVisibleSelect().find('li').last().click({ force: true });
			WorkflowPage.getters.workflowSettingsTimeoutWorkflowSwitch().click();
			WorkflowPage.getters.workflowSettingsTimeoutForm().find('input').first().type('1');
			// Save settings
			WorkflowPage.getters.workflowSettingsSaveButton().click();
			WorkflowPage.getters.workflowSettingsModal().should('not.exist');
			WorkflowPage.getters.successToast().should('exist');
		});
	});

	it('should not be able to delete unsaved workflow', () => {
		WorkflowPage.getters.workflowMenu().should('be.visible');
		WorkflowPage.getters.workflowMenu().click();
		WorkflowPage.getters.workflowMenuItemDelete().closest('li').should('have.class', 'is-disabled');
	});

	it('should delete workflow', () => {
		WorkflowPage.actions.saveWorkflowOnButtonClick();
		WorkflowPage.getters.workflowMenu().should('be.visible');
		WorkflowPage.getters.workflowMenu().click();
		WorkflowPage.getters.workflowMenuItemDelete().click();
		cy.get('div[role=dialog][aria-modal=true]').should('be.visible');
		cy.get('button.btn--confirm').should('be.visible').click();
		WorkflowPage.getters.successToast().should('exist');
		cy.url().should('include', '/workflow/new');
	});

	describe('duplicate workflow', () => {
		function duplicateWorkflow() {
			WorkflowPage.getters.workflowMenu().should('be.visible');
			WorkflowPage.getters.workflowMenu().click();
			WorkflowPage.getters.workflowMenuItemDuplicate().click();
			WorkflowPage.getters.duplicateWorkflowModal().should('be.visible');
			WorkflowPage.getters.duplicateWorkflowModal().find('input').first().should('be.visible');
			WorkflowPage.getters.duplicateWorkflowModal().find('input').first().type('{selectall}');
			WorkflowPage.getters
				.duplicateWorkflowModal()
				.find('input')
				.first()
				.type(DUPLICATE_WORKFLOW_NAME);
			WorkflowPage.getters
				.duplicateWorkflowModal()
				.find('.el-select__tags input')
				.type(DUPLICATE_WORKFLOW_TAG);
			WorkflowPage.getters.duplicateWorkflowModal().find('.el-select__tags input').type('{enter}');
			WorkflowPage.getters.duplicateWorkflowModal().find('.el-select__tags input').type('{esc}');
			WorkflowPage.getters
				.duplicateWorkflowModal()
				.find('button')
				.contains('Duplicate')
				.should('be.visible');
			WorkflowPage.getters.duplicateWorkflowModal().find('button').contains('Duplicate').click();
			WorkflowPage.getters.errorToast().should('not.exist');
		}

		beforeEach(() => {
			// Stub window.open so new tab is not getting opened
			cy.window().then((win) => {
				cy.stub(win, 'open').as('open');
			});
			WorkflowPage.actions.addNodeToCanvas(MANUAL_TRIGGER_NODE_NAME);
		});

		it('should duplicate unsaved workflow', () => {
			duplicateWorkflow();
		});

		it('should duplicate saved workflow', () => {
			WorkflowPage.actions.saveWorkflowOnButtonClick();
			duplicateWorkflow();
		});
	});

	it('should keep endpoint click working when switching between execution and editor tab', () => {
		cy.intercept('GET', '/rest/executions?filter=*').as('getExecutions');
		cy.intercept('GET', '/rest/executions/active?filter=*').as('getActiveExecutions');

		WorkflowPage.actions.addInitialNodeToCanvas(MANUAL_TRIGGER_NODE_NAME);
		WorkflowPage.actions.addNodeToCanvas(EDIT_FIELDS_SET_NODE_NAME);
		WorkflowPage.actions.saveWorkflowOnButtonClick();

		WorkflowPage.getters.canvasNodePlusEndpointByName(EDIT_FIELDS_SET_NODE_NAME).click();
		WorkflowPage.getters.nodeCreatorSearchBar().should('be.visible');
		cy.get('body').type('{esc}');

		executionsTab.actions.switchToExecutionsTab();
		cy.wait(['@getExecutions', '@getActiveExecutions']);
		cy.wait(500);
		executionsTab.actions.switchToEditorTab();

		WorkflowPage.getters.canvasNodePlusEndpointByName(EDIT_FIELDS_SET_NODE_NAME).click();
		WorkflowPage.getters.nodeCreatorSearchBar().should('be.visible');
	});
});

describe('Menu entry Push To Git', () => {
	it('should not show up in the menu for members', () => {
		cy.signin(INSTANCE_MEMBERS[0]);
		cy.visit(WorkflowPages.url);
		WorkflowPage.actions.visit();
		WorkflowPage.getters.workflowMenuItemGitPush().should('not.exist');
	});

	it('should show up for owners', () => {
		cy.signin(INSTANCE_OWNER);
		cy.visit(WorkflowPages.url);
		WorkflowPage.actions.visit();
		WorkflowPage.getters.workflowMenuItemGitPush().should('exist');
	});
});
