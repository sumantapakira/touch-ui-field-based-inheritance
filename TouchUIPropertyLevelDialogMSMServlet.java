package com.myorg.cq.servlets;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import javax.jcr.Node;
import javax.jcr.RepositoryException;
import javax.jcr.Value;
import javax.jcr.lock.LockException;
import javax.jcr.nodetype.ConstraintViolationException;
import javax.jcr.nodetype.NoSuchNodeTypeException;
import javax.jcr.version.VersionException;
import javax.servlet.ServletException;

import org.apache.commons.lang3.ArrayUtils;
import org.apache.commons.lang3.StringUtils;
import org.apache.felix.scr.annotations.Reference;
import org.apache.felix.scr.annotations.sling.SlingServlet;
import org.apache.jackrabbit.JcrConstants;
import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.api.SlingHttpServletResponse;
import org.apache.sling.api.resource.ModifiableValueMap;
import org.apache.sling.api.resource.Resource;
import org.apache.sling.api.resource.ResourceResolver;
import org.apache.sling.api.servlets.HtmlResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.day.cq.commons.servlets.AbstractPredicateServlet;
import com.day.cq.wcm.msm.api.LiveRelationship;
import com.day.cq.wcm.msm.api.LiveRelationshipManager;
import com.day.cq.wcm.msm.api.MSMNameConstants;
import com.day.text.Text;
import com.myorg.cq.commons.Constants;
import com.myorg.cq.events.touchui.nestedmfm.NestedMfmUtils;
import com.myorg.msm.RolloutHierarchicalObj;

@SlingServlet(resourceTypes = { "sling/servlet/default" }, selectors = { "touchuimsm" }, extensions = { "conf",
		"json" }, methods = { "POST" })
public class TouchUIPropertyLevelDialogMSMServlet extends AbstractPredicateServlet {

	private static final long serialVersionUID = 1L;
	private static final Logger LOG = LoggerFactory.getLogger(TouchUIPropertyLevelDialogMSMServlet.class);
	private static final String REQ_PARAM_COMMAND = "cmd";
	private static final String REQ_PARAM_MSM = "msm:propertyName";
	private static final String ITEM_REGEX = Constants.CORAL_UI_MF_CHILD_NAME + "\\d.*";
	private static final String CUI_FILTER_COMPONENT_MULTIFIELD_NAME = "filters";

	@Reference
	private LiveRelationshipManager relationshipManager = null;

	protected void doPost(final SlingHttpServletRequest request, final SlingHttpServletResponse response)
			throws ServletException, IOException {
		final HtmlResponse htmlResponse = new HtmlResponse();
		try {
			Resource resource = request.getResource();

			LiveRelationship currentRelation = this.relationshipManager.getLiveRelationship(resource, true);

			if (currentRelation == null
					|| currentRelation.getStatus().getAdvancedStatus("msm:isTargetManuallyCreated").booleanValue()) {

				LOG.error("Request to edit PropertyInheritance of non LiveRelation at {}: abort", resource.getPath());
				String msg = String.format("Can not attach Resource at %s either already a LiveCopy or no Source",
						new Object[] { resource.getPath() });
				throw new IllegalStateException(msg);
			}
			if (!StringUtils.isEmpty(request.getParameter(REQ_PARAM_COMMAND))) {
				this.processFromCMDParam(request, request.getParameter(REQ_PARAM_COMMAND), currentRelation);
			}
			htmlResponse.setStatus(200, "Live relationship updated");

		} catch (Exception e) {
			LOG.error("Error : ", e);
		}
		response.setContentType("text/html");
		response.setCharacterEncoding("utf-8");

		htmlResponse.send(response, true);
	}

	private void processFromCMDParam(final SlingHttpServletRequest request, final String command,
			LiveRelationship currentRelation) throws Exception {
		final Resource resource = request.getResource();

		ResourceResolver resolver = request.getResourceResolver();
		if (Constants.DIALOG_EVENT_CANCEL_INHERIT_COMMAND.equals((Object) command)) {

			// dirty hack for filter components only
			if (request.getParameter(REQ_PARAM_MSM).contains(Constants.COMMA)) {
				String[] propertyArray = request.getParameter(REQ_PARAM_MSM).split(Constants.COMMA);
				if (propertyArray != null && propertyArray.length > 0
						&& ArrayUtils.contains(propertyArray, CUI_FILTER_COMPONENT_MULTIFIELD_NAME)) {
					List<String> list = new ArrayList<String>(Arrays.asList(propertyArray));
					list.add(CUI_FILTER_COMPONENT_MULTIFIELD_NAME);
					this.relationshipManager.cancelPropertyRelationship(request.getResourceResolver(), currentRelation,
							list.toArray(new String[0]), true);
				}
			} else {
				String[] props = getPropsForCancelEnableInheritance(resolver, resource,
						request.getParameterValues(REQ_PARAM_MSM));
				this.relationshipManager.cancelPropertyRelationship(request.getResourceResolver(), currentRelation,
						props, true);
			}
			if (request.getResource().hasChildren()) {
				setMultifieldItemInheritance(request, true);
			}
			resolver.commit();

		} else if (Constants.DIALOG_EVENT_REENABLE_INHERIT_COMMAND.equals((Object) command)) {

			if (request.getParameter(REQ_PARAM_MSM).contains(Constants.COMMA)) {
				String[] propertyArray = request.getParameter(REQ_PARAM_MSM).split(Constants.COMMA);
				if (propertyArray != null && propertyArray.length > 0
						&& ArrayUtils.contains(propertyArray, CUI_FILTER_COMPONENT_MULTIFIELD_NAME)) {
					List<String> list = new ArrayList<String>(Arrays.asList(propertyArray));
					list.add(CUI_FILTER_COMPONENT_MULTIFIELD_NAME);
					this.relationshipManager.reenablePropertyRelationship(resolver, currentRelation,
							list.toArray(new String[0]), false);
				}
			} else {
				String[] props = getPropsForCancelEnableInheritance(resolver, resource,
						request.getParameterValues(REQ_PARAM_MSM));
				this.relationshipManager.reenablePropertyRelationship(resolver, currentRelation, props, false);
			}

			RolloutHierarchicalObj page = getContainingRolloutHierarchicalObj(resource.getResourceResolver(),
					resource.getPath());
			if (page != null && page.hasContent()) {
				ModifiableValueMap pageProps = (ModifiableValueMap) page.getContentResource()
						.adaptTo(ModifiableValueMap.class);
				pageProps.remove(MSMNameConstants.PN_LAST_ROLLEDOUT);
			}
			Resource currentTargetResource = resolver.getResource(currentRelation.getTargetPath());
			ModifiableValueMap resourceProps = (ModifiableValueMap) currentTargetResource
					.adaptTo(ModifiableValueMap.class);
			resourceProps.remove(MSMNameConstants.PN_LAST_ROLLEDOUT);
			if (request.getResource().hasChildren()) {
				setMultifieldItemInheritance(request, false);
			}
			resolver.commit();
		}
	}

	private String[] getPropsForCancelEnableInheritance(ResourceResolver resolver, Resource resource,
			String[] propsFromRequest) {
		boolean isNestedMfmResourceType = NestedMfmUtils.isNestedMfmResourceType(resolver, resource);
		String[] props = null;
		// The resource with nested mfms store the CUI data in a property and the TUI
		// data in hierarchical nodes.
		// We have to add both properties if one is sent via this servlet to keep the
		// inheritance status in sync.
		if (isNestedMfmResourceType) {
			String tuiNodeName = NestedMfmUtils.getTuiNodeNameForResource(resource.getResourceType());
			String cuiPropertName = NestedMfmUtils.getCuiPropertyNameForResource(resource.getResourceType());
			Set<String> propNamesFromRequest = new HashSet<>(Arrays.asList(propsFromRequest));
			if (propNamesFromRequest.contains(tuiNodeName)) {
				propNamesFromRequest.add(cuiPropertName);
			} else if (propNamesFromRequest.contains(cuiPropertName)) {
				propNamesFromRequest.add(tuiNodeName);
			}
			props = propNamesFromRequest.toArray(new String[propNamesFromRequest.size()]);
		} else {
			props = propsFromRequest;
		}
		return props;
	}

	private void setMultifieldItemInheritance(final SlingHttpServletRequest request, boolean isCancel)
			throws RepositoryException {

		Resource resource = request.getResource();
		boolean hasNestedMfms = NestedMfmUtils.isNestedMfmResourceType(request.getResourceResolver(), resource);

		String mfPropRelPath = hasNestedMfms ? NestedMfmUtils.getTuiNodeNameForResource(resource.getResourceType())
				: request.getParameter(REQ_PARAM_MSM);
		if (mfPropRelPath == null) {
			LOG.warn("Cannot determine the mf node for the resource at {}", resource.getPath());
			return;
		}
		if (request.getParameter(REQ_PARAM_MSM).contains(Constants.COMMA)) {
			String[] propertyArray = request.getParameter(REQ_PARAM_MSM).split(Constants.COMMA);
			for (String property : propertyArray) {
				Resource multifieldResource = resource.getChild(property);
				setMSMProperties(multifieldResource, isCancel, hasNestedMfms, request);
			}
		} else {
			Resource multifieldResource = resource.getChild(mfPropRelPath);
			setMSMProperties(multifieldResource, isCancel, hasNestedMfms, request);
		}

	}

	private void setMSMProperties(Resource multifieldResource, boolean isCancel, boolean hasNestedMfms,
			final SlingHttpServletRequest request) throws NoSuchNodeTypeException, VersionException,
			ConstraintViolationException, LockException, RepositoryException {
		if (multifieldResource != null) {

			Node multifieldnode = multifieldResource.adaptTo(Node.class);
			if (multifieldnode == null) {
				LOG.warn("Path '{}' cannot be adapted to a jcr node.", request.getRequestPathInfo().getResourcePath());
			} else {
				if (!isCancel) {
					enableComponentInheritance(multifieldnode);
				} else {
					multifieldnode.addMixin(MSMNameConstants.NT_LIVE_SYNC_CANCELLED);
				}
				Iterator<Resource> multifieldItemIterator = multifieldResource.listChildren();
				while (multifieldItemIterator.hasNext()) {
					Resource multifieldItemResource = multifieldItemIterator.next();

					if (multifieldItemResource.getName().matches(ITEM_REGEX)) {
						setLiveSyncProperties(multifieldItemResource.adaptTo(Node.class), isCancel);
					}
					if (hasNestedMfms) {
						handleNestedMFItemInheritance(multifieldItemResource, isCancel);
					}
				}
			}
		} else {
			LOG.warn("No resource found below: {}", request.getRequestPathInfo().getResourcePath());
		}
	}

	private void handleNestedMFItemInheritance(Resource multfieldItemResource, boolean isCancel)
			throws RepositoryException {
		Iterator<Resource> nestedIt = multfieldItemResource.listChildren();
		while (nestedIt.hasNext()) {
			Resource nestedResource = nestedIt.next();
			boolean hasNestedItemChildren = false;
			if (nestedResource.hasChildren()) {
				Iterator<Resource> nestedMultifieldItemIterator = nestedResource.listChildren();
				while (nestedMultifieldItemIterator.hasNext()) {
					Resource nestedMultifieldItemResource = nestedMultifieldItemIterator.next();
					if (nestedMultifieldItemResource.getName().matches(ITEM_REGEX)) {
						hasNestedItemChildren = true;
						setLiveSyncProperties(nestedMultifieldItemResource.adaptTo(Node.class), isCancel);
					}
				}
				if (hasNestedItemChildren) {
					setLiveSyncProperties(nestedResource.adaptTo(Node.class), isCancel);
				}
			}
		}
	}

	private void setLiveSyncProperties(Node node, boolean isCancel) throws RepositoryException {
		if (!isCancel) {
			enableComponentInheritance(node);
			node.getParent().setProperty(MSMNameConstants.PN_IS_CANCELLED_FOR_CHILDREN, Boolean.FALSE);
		} else {
			node.addMixin(MSMNameConstants.NT_LIVE_SYNC_CANCELLED);
			node.getParent().setProperty(MSMNameConstants.PN_IS_CANCELLED_FOR_CHILDREN, Boolean.TRUE);
		}
	}

	/*
	 * This is done because after author makes changes to property then system
	 * should enable inheritance otherwise rollout process will not make changes to
	 * the required property
	 * 
	 */
	private void enableComponentInheritance(Node node) {
		try {
			if (node.hasProperty(JcrConstants.JCR_MIXINTYPES)) {
				Value[] mixinValues = node.getProperty(JcrConstants.JCR_MIXINTYPES).getValues();

				for (Value propertyValue : mixinValues) {
					if (propertyValue.getString().equals(MSMNameConstants.NT_LIVE_SYNC_CANCELLED)) {
						node.removeMixin(MSMNameConstants.NT_LIVE_SYNC_CANCELLED);
						if (node.hasProperty(MSMNameConstants.PN_IS_CANCELLED_FOR_CHILDREN)) {
							node.getProperty(MSMNameConstants.PN_IS_CANCELLED_FOR_CHILDREN).remove();
						}
						break;
					}
				}
			}
		} catch (Exception pnte) {
			LOG.error("Error : ", pnte);
		}
	}

	public RolloutHierarchicalObj getContainingRolloutHierarchicalObj(ResourceResolver resolver, String absPath) {
		if (!absPath.startsWith("/")) {
			throw new IllegalArgumentException("Only absolute Paths accepted");
		}

		String currentPath = absPath;
		while (!StringUtils.isEmpty(currentPath) && !currentPath.equals("/")) {

			Resource resource = resolver.getResource(currentPath);
			if (resource != null) {
				RolloutHierarchicalObj rolloutHierarchicalObj = (RolloutHierarchicalObj) resource
						.adaptTo(RolloutHierarchicalObj.class);
				if (rolloutHierarchicalObj != null) {
					return rolloutHierarchicalObj;
				}
			}

			currentPath = Text.getRelativeParent(currentPath, 1);
		}
		return null;
	}
}
